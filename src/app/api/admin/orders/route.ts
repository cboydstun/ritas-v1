import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { MACHINE_CAPACITY, dateStringSchema } from "@/lib/validation";
import { isMachineAvailable } from "@/lib/inventory";
import { isMachineType } from "@/types/machine";
import { resolveSelectedExtras } from "@/lib/extras-catalog";
import {
  computeOrderTotal,
  type SettingsOverrides,
} from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";
import { nanoid } from "nanoid";

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
export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    await dbConnect();
    const rentals = await Rental.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .select("-__v"); // Exclude version key

    return NextResponse.json(rentals);
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
    const data = await request.json();
    await dbConnect();

    // Whitelist, mirroring the PUT handler and /api/save-booking. Passing the
    // raw body to `new Rental(data)` let a caller set `_id`, `createdAt`,
    // `bookingId` and `payment` directly, and skipped the server-side price
    // recompute entirely.
    const doc: Record<string, unknown> = {};
    for (const field of CREATABLE_ORDER_FIELDS) {
      if (data[field] !== undefined) doc[field] = data[field];
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

    const totals = computeOrderTotal(
      {
        machineType: doc.machineType,
        selectedMixers: doc.selectedMixers ?? [],
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
    doc.price = Number(totals.finalTotal.toFixed(2));
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
    console.error("Error creating order:", error);

    // Enhanced error logging for schema validation issues
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

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
