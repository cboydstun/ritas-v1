import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { MACHINE_CAPACITY } from "@/lib/validation";
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

    if (typeof doc.machineType !== "string" || !isMachineType(doc.machineType)) {
      return NextResponse.json(
        { message: "Invalid machine type" },
        { status: 400 },
      );
    }
    doc.capacity = MACHINE_CAPACITY[doc.machineType];

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
        rentalDate: doc.rentalDate ?? "",
        returnDate: doc.returnDate ?? "",
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
    doc.bookingId = nanoid(10);
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
      if (error.name === "ValidationError") {
        return NextResponse.json(
          {
            message: "Invalid rental data",
            details: error.message,
          },
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
