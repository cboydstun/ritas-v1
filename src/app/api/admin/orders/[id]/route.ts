import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import {
  MACHINE_CAPACITY,
  MAX_RANGE_DAYS,
  dateStringSchema,
} from "@/lib/validation";
import { isMachineType } from "@/types/machine";
import { Settings } from "@/models/settings";
import { isMachineAvailable } from "@/lib/inventory";
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
import { spanInDays } from "@/lib/dates";
import mongoose from "mongoose";
import { guardAdminWrite } from "@/lib/api-guard";

/**
 * Fields an admin may change on an existing order.
 *
 * `capacity` is deliberately absent: it is derived from `machineType` below,
 * matching the invariant `/api/save-booking` enforces. Accepting it also broke
 * every edit — the schema validator reads `this.machineType`, which is
 * undefined under update validators, so any payload carrying `capacity` failed
 * validation and surfaced as a 500.
 *
 * `price` is absent for the same reason: it is recomputed from the merged
 * order below, so an edit to the machine type or the dates can no longer leave
 * a stale total behind.
 */
const EDITABLE_ORDER_FIELDS = [
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
  "payment",
] as const;

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get a specific order
export async function GET(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // An invalid id produced a Mongoose CastError and a 500 instead of a 404.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  try {
    await dbConnect();
    const rental = await Rental.findById(id).select("-__v");

    if (!rental) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(rental);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { message: "Failed to fetch order" },
      { status: 500 },
    );
  }
}

// Update an order
export async function PUT(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // An invalid id produced a Mongoose CastError and a 500 instead of a 404.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  try {
    // Admin handlers read the body directly, so MAX_BODY_BYTES never
    // applied to them. Post-auth this bounds a compromised session.
    const guard = await guardAdminWrite(request);
    if (!guard.ok) return guard.response;
    const data = guard.data as Record<string, unknown>;
    await dbConnect();

    // Whitelist the fields an admin may edit. Spreading the body allowed
    // writes to `_id`, `createdAt` and anything else the schema declares.
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of EDITABLE_ORDER_FIELDS) {
      if (data[field] !== undefined) update[field] = data[field];
    }

    // Capacity follows the machine type, never the request body.
    if (typeof update.machineType === "string") {
      if (!isMachineType(update.machineType)) {
        return NextResponse.json(
          { message: "Invalid machine type" },
          { status: 400 },
        );
      }
      update.capacity = MACHINE_CAPACITY[update.machineType];
    }

    const existing = await Rental.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // The edit is applied to a copy first, so availability and price are
    // judged against what the order will actually become.
    const merged = { ...existing, ...update } as unknown as {
      machineType: "single" | "double" | "triple";
      capacity: 15 | 30 | 45;
      selectedMixers: string[];
      selectedExtras: unknown;
      rentalDate: string;
      returnDate: string;
      status?: string;
    };

    // The POST handler validates both dates and their ordering; this one did
    // neither, and the schema type is a bare String. `PUT { returnDate }`
    // earlier than the rental date made `eachDayInRange` return [], which made
    // `isMachineAvailable` skip both of its loops and report available
    // regardless of blackouts or a full date; `spanInDays` then went negative
    // and `Math.max(1, ...)` repriced a multi-day rental as one day. The
    // stored document could no longer satisfy the overlap query either, so its
    // unit silently left inventory accounting.
    const rentalDate = dateStringSchema.safeParse(merged.rentalDate);
    const returnDate = dateStringSchema.safeParse(merged.returnDate);
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
    // Unbounded ranges expand day-by-day in `eachDayInRange` and multiply the
    // per-day rate, so the public route's ceiling applies here too.
    if (spanInDays(rentalDate.data, returnDate.data) > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { message: `Rental cannot exceed ${MAX_RANGE_DAYS} days` },
        { status: 400 },
      );
    }

    // Reviving a cancelled order puts a unit back on a date that may have
    // filled up while it was cancelled. Only the machine/date fields used to
    // count as a booking change, so `PUT { status: "confirmed" }` restored the
    // order with no availability check at all.
    const existingStatus = (existing as { status?: string }).status;
    const revivesCancelled =
      existingStatus === "cancelled" &&
      update.status !== undefined &&
      update.status !== "cancelled";

    const changesBooking =
      update.machineType !== undefined ||
      update.rentalDate !== undefined ||
      update.returnDate !== undefined ||
      revivesCancelled;

    // An admin edit used to bypass the availability check entirely, so moving
    // an order onto a full date silently oversold it.
    if (changesBooking && merged.status !== "cancelled") {
      const availability = await isMachineAvailable(
        merged.machineType,
        merged.capacity,
        merged.rentalDate,
        merged.returnDate,
        { excludeRentalId: id },
      );
      if (!availability.available) {
        return NextResponse.json(
          { message: availability.reason ?? "Machine is not available" },
          { status: 409 },
        );
      }
    }

    // Recompute the total from the merged order, using the same function the
    // customer-facing form and /api/save-booking use.
    const settingsDoc = (await Settings.findOne({ key: "global" }).lean()) as {
      fees?: SettingsOverrides["fees"];
      machines?: SettingsOverrides["machines"];
      mixers?: SettingsOverrides["mixers"];
      extras?: SettingsOverrides["extras"];
    } | null;

    const overrides: SettingsOverrides = {
      fees: settingsDoc?.fees,
      machines: settingsDoc?.machines,
      mixers: settingsDoc?.mixers,
      extras: settingsDoc?.extras,
    };

    // Whether this edit touches anything the total is derived from. It used
    // to be unconditional, so a `PUT { status }` from OrdersTable's status
    // control — or `PUT { payment }` from its payment-status control —
    // repriced a months-old order at *today's* Settings. Marking a payment
    // collected was the precise action that rewrote the collected amount, and
    // the stored total then disagreed with the confirmation email and the
    // QuickBooks invoice. Historical orders keep the price they were sold at.
    const PRICING_FIELDS = [
      "machineType",
      "selectedMixers",
      "selectedExtras",
      "rentalDate",
      "returnDate",
    ] as const;
    const changesPricing = PRICING_FIELDS.some(
      (field) => update[field] !== undefined,
    );

    const { extras: resolvedExtras, unknownIds } = resolveSelectedExtras(
      merged.selectedExtras,
      { extras: settingsDoc?.extras, mixers: settingsDoc?.mixers },
    );
    // Only ids the caller actually sent are rejected. `merged` falls back to
    // the stored order, so resolving against the *current* catalog used to
    // 400 on an id an admin had since deleted from Settings — locking the
    // order out of every edit, including `{ status: "cancelled" }`, while it
    // went on holding its unit.
    if (update.selectedExtras !== undefined && unknownIds.length > 0) {
      return NextResponse.json(
        { message: `Unknown extras: ${unknownIds.join(", ")}` },
        { status: 400 },
      );
    }

    // Same gap as the create route: mixers reached computeOrderTotal
    // unresolved, so a non-array 500'd and an unknown flavour priced at 0.
    const { mixers: resolvedMixers, unknownIds: unknownMixerIds } =
      resolveSelectedMixers(merged.selectedMixers, {
        extras: settingsDoc?.extras,
        mixers: settingsDoc?.mixers,
      });
    if (update.selectedMixers !== undefined && unknownMixerIds.length > 0) {
      return NextResponse.json(
        { message: `Unknown mixers: ${unknownMixerIds.join(", ")}` },
        { status: 400 },
      );
    }
    if (update.selectedMixers !== undefined) {
      update.selectedMixers = resolvedMixers;
    }

    if (changesPricing) {
      const totals = computeOrderTotal(
        {
          machineType: merged.machineType,
          selectedMixers: resolvedMixers,
          selectedExtras: resolvedExtras,
          rentalDate: rentalDate.data,
          returnDate: returnDate.data,
          isServiceDiscount: false,
        } as OrderFormData,
        overrides,
      );

      if (update.selectedExtras !== undefined) {
        update.selectedExtras = resolvedExtras;
      }
      update.price = roundCurrency(totals.finalTotal);

      // `payment.amount` follows the recomputed total. It used to be left
      // alone whenever the caller sent a `payment` object, and OrdersTable's
      // payment-status control sends the whole object with the client's
      // cached amount — so an order edited after a pricing change kept a
      // stale amount against a fresh price.
      if (update.payment !== undefined) {
        const payment = update.payment as Record<string, unknown>;
        update.payment = { ...payment, amount: update.price };
      } else if ((existing as { payment?: unknown }).payment) {
        update["payment.amount"] = update.price;
      } else {
        // The dotted `$set` on an order with no payment subdocument created
        // `payment: { amount }` with neither `status` nor `date`. Update
        // validators only run on paths present in the update, so the schema's
        // `required` on both never fired and a structurally invalid payment
        // was persisted. Write a whole, valid subdocument instead.
        update.payment = {
          amount: update.price,
          status: "pending",
          date: new Date(),
        };
      }
    } else if (update.payment !== undefined) {
      // Not a pricing edit, so the stored price stands and the payment object
      // must not carry the client's cached amount in over the top of it.
      const payment = update.payment as Record<string, unknown>;
      const storedPrice = (existing as { price?: number }).price;
      update.payment =
        storedPrice === undefined
          ? payment
          : { ...payment, amount: storedPrice };
    }

    const rental = await Rental.findByIdAndUpdate(id, update, {
      new: true, // Return updated document
      runValidators: true, // Run schema validators
    }).select("-__v");

    if (!rental) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(rental);
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { message: Object.values(error.errors)[0]?.message ?? error.message },
        { status: 400 },
      );
    }
    console.error("Error updating order:", error);
    return NextResponse.json(
      { message: "Failed to update order" },
      { status: 500 },
    );
  }
}

// Delete an order
export async function DELETE(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // An invalid id produced a Mongoose CastError and a 500 instead of a 404.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  try {
    await dbConnect();
    const rental = await Rental.findByIdAndDelete(id);

    if (!rental) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Order deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { message: "Failed to delete order" },
      { status: 500 },
    );
  }
}
