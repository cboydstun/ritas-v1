import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { MACHINE_CAPACITY, dateStringSchema } from "@/lib/validation";
import { isMachineAvailable } from "@/lib/inventory";
import { safeErrorSummary } from "@/lib/safe-error";
import { isMachineType } from "@/types/machine";
import {
  resolveSelectedExtras,
  resolveSelectedMixers,
} from "@/lib/extras-catalog";
import {
  computeOrderTotal,
  roundCurrency,
  type SettingsOverrides,
} from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";
import { nanoid } from "nanoid";
import { adminListLimit, adminListHeaders } from "@/lib/admin-list";
import { guardAdminWrite } from "@/lib/api-guard";

/** Fields an admin may set when creating an order by hand. */
const CREATABLE_ORDER_FIELDS = [
  "machineType",
  "selectedMixers",
  "selectedExtras",
  "rentalDate",
  "rentalTime",
  "returnDate",
  "returnTime",
  "customer",
  "notes",
  "status",
] as const;

// Get all orders
export async function GET(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    await dbConnect();
    const limit = adminListLimit(
      new URL(request.url).searchParams.get("limit"),
    );
    const [rentals, total] = await Promise.all([
      Rental.find({})
        .sort({ createdAt: -1 }) // Sort by newest first
        .limit(limit)
        .select("-__v") // Exclude version key
        .lean(),
      Rental.countDocuments({}),
    ]);

    return NextResponse.json(rentals, {
      headers: adminListHeaders(total, rentals.length),
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { message: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}

// Create a new order (if needed in admin panel)
export async function POST(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    // Admin handlers read the body directly, so MAX_BODY_BYTES never
    // applied to them. Post-auth this bounds a compromised session.
    const guard = await guardAdminWrite(request);
    if (!guard.ok) return guard.response;
    const data = guard.data as Record<string, unknown>;
    await dbConnect();

    // Whitelist, mirroring the PUT handler and /api/save-booking. Passing the
    // raw body to `new Rental(data)` let a caller set `_id`, `createdAt`,
    // `bookingId` and `payment` directly, and skipped the server-side price
    // recompute entirely.
    const doc: Record<string, unknown> = {};
    for (const field of CREATABLE_ORDER_FIELDS) {
      if (data[field] !== undefined) doc[field] = data[field];
    }

    // `status` was copied straight from the body with no validation and no
    // default, so an omitted status fell through to the schema default
    // `pending` — which `releaseStaleHolds` cancels after STALE_HOLD_MINUTES,
    // with no provenance check. An order created through the API rather than
    // CreateOrderModal flipped itself to `cancelled` two hours later and put
    // its unit back on sale. `pending_payment` is what a submitted booking
    // carries and is the right default for a hand-created order.
    const ADMIN_CREATABLE_STATUSES: readonly string[] = [
      "pending",
      "pending_payment",
      "confirmed",
      "in-progress",
      "completed",
      "cancelled",
    ];
    if (doc.status === undefined) {
      doc.status = "pending_payment";
    } else if (
      typeof doc.status !== "string" ||
      !ADMIN_CREATABLE_STATUSES.includes(doc.status)
    ) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    if (
      typeof doc.machineType !== "string" ||
      !isMachineType(doc.machineType)
    ) {
      return NextResponse.json(
        { message: "Invalid machine type" },
        { status: 400 },
      );
    }
    const capacity = MACHINE_CAPACITY[doc.machineType];
    doc.capacity = capacity;

    // Dates were previously passed through unvalidated and defaulted to ""
    // for the price computation, so a missing or malformed date silently
    // priced as a single rental day before Mongoose's `required` fired.
    const rentalDate = dateStringSchema.safeParse(doc.rentalDate);
    const returnDate = dateStringSchema.safeParse(doc.returnDate);
    if (!rentalDate.success || !returnDate.success) {
      return NextResponse.json(
        { message: "rentalDate and returnDate must be valid YYYY-MM-DD dates" },
        { status: 400 },
      );
    }
    if (returnDate.data < rentalDate.data) {
      return NextResponse.json(
        { message: "Return date must be on or after the rental date" },
        { status: 400 },
      );
    }

    // The PUT handler has re-checked availability since admin edits were found
    // to oversell dates; POST had no check at all, so creating an order by
    // hand on a full date was the same hole by another route.
    if (doc.status !== "cancelled") {
      const availability = await isMachineAvailable(
        doc.machineType,
        capacity,
        rentalDate.data,
        returnDate.data,
      );
      if (!availability.available) {
        return NextResponse.json(
          { message: availability.reason ?? "Machine is not available" },
          { status: 409 },
        );
      }
    }

    const settingsDoc = (await Settings.findOne({ key: "global" }).lean()) as {
      fees?: SettingsOverrides["fees"];
      machines?: SettingsOverrides["machines"];
      mixers?: SettingsOverrides["mixers"];
      extras?: SettingsOverrides["extras"];
    } | null;

    const { extras: resolvedExtras, unknownIds } = resolveSelectedExtras(
      doc.selectedExtras,
      { extras: settingsDoc?.extras, mixers: settingsDoc?.mixers },
    );
    if (unknownIds.length > 0) {
      return NextResponse.json(
        { message: `Unknown extras: ${unknownIds.join(", ")}` },
        { status: 400 },
      );
    }

    // Mixers went straight from the body into computeOrderTotal, which
    // /api/save-booking never did. A non-array threw inside `mixers.reduce`
    // and surfaced as a 500; an unknown flavour silently priced at 0.
    const { mixers: resolvedMixers, unknownIds: unknownMixerIds } =
      resolveSelectedMixers(doc.selectedMixers, {
        extras: settingsDoc?.extras,
        mixers: settingsDoc?.mixers,
      });
    if (unknownMixerIds.length > 0) {
      return NextResponse.json(
        { message: `Unknown mixers: ${unknownMixerIds.join(", ")}` },
        { status: 400 },
      );
    }
    doc.selectedMixers = resolvedMixers;

    const totals = computeOrderTotal(
      {
        machineType: doc.machineType,
        selectedMixers: resolvedMixers,
        selectedExtras: resolvedExtras,
        rentalDate: rentalDate.data,
        returnDate: returnDate.data,
        isServiceDiscount: false,
      } as OrderFormData,
      {
        fees: settingsDoc?.fees,
        machines: settingsDoc?.machines,
        mixers: settingsDoc?.mixers,
        extras: settingsDoc?.extras,
      },
    );

    doc.selectedExtras = resolvedExtras;
    doc.price = roundCurrency(totals.finalTotal);
    doc.isServiceDiscount = false;
    doc.bookingId = nanoid(10).toUpperCase();
    doc.payment = {
      paypalTransactionId: null,
      amount: doc.price,
      status: "pending",
      date: new Date(),
    };

    const rental = new Rental(doc);
    const savedRental = await rental.save();

    return NextResponse.json(savedRental, { status: 201 });
  } catch (error) {
    // Only the error's shape is logged — Mongoose validation and duplicate-key
    // messages embed the offending customer values, and production builds
    // keep console.error.
    console.error("Error creating order:", safeErrorSummary(error));

    if (error instanceof Error) {
      // Check for validation errors (e.g., missing required fields or invalid mixer selections)
      // `error.message` carries model names, field paths and index names, so
      // it is logged above rather than returned.
      if (error.name === "ValidationError") {
        return NextResponse.json(
          { message: "Invalid rental data" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 },
    );
  }
}
