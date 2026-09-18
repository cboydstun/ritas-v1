import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { isMachineAvailable, releaseStaleHolds } from "@/lib/inventory";
import { nanoid } from "nanoid";
import { mixerDetails } from "@/lib/rental-data";
import {
  computeOrderTotal,
  validateDeliveryTime,
  type OrderTotals,
  type SettingsOverrides,
} from "@/components/order/utils";
import { resolveDeliveryFee } from "@/lib/delivery/resolveDeliveryFee";
import { minimumForZip, minimumOrderError } from "@/lib/delivery/tierMinimums";
import type { DeliverySettings } from "@/lib/delivery/zones";
import type { OrderFormData } from "@/components/order/types";
import {
  resolveSelectedExtras,
  resolveSelectedMixers,
} from "@/lib/extras-catalog";
import {
  MACHINE_CAPACITY,
  firstIssueMessage,
  rentalDataSchema,
} from "@/lib/validation";
import type { RentalStatus } from "@/types";
import type { RentalLike } from "@/lib/booking/notify";

/**
 * The status a booking is written with.
 *
 * `pending_payment` is the invoice path: a submitted order the customer holds
 * a confirmation email for. It is **never** reaped — see the comment on
 * `releaseStaleHolds` in `src/lib/inventory.ts`.
 *
 * `pending` is the PayPal hold, written before the payment window opens. It
 * counts toward inventory while newer than `STALE_HOLD_MINUTES` and is swept
 * afterwards, which is exactly what an abandoned checkout needs. Writing that
 * hold as `pending_payment` would park a unit forever.
 */
export type BookingStatus = Extract<
  RentalStatus,
  "pending" | "pending_payment"
>;

export interface CreateBookingOptions {
  status: BookingStatus;
  /**
   * Reuse an existing unpaid hold rather than inserting a second one.
   *
   * The PayPal SDK calls `createOrder` on every button click, and there are
   * three buttons — without this, a buyer who cancels and clicks a different
   * funding source holds two units for one cart, and with two triples in stock
   * two abandons lock them out of their own booking.
   */
  reuseBookingId?: string;
}

export interface CreateBookingSuccess {
  ok: true;
  /** The constructed document — what the notifications read. */
  rental: RentalLike & Record<string, unknown>;
  /** The `save()` result, which is what carries `_id` and `createdAt`. */
  savedRental: { _id: { toString(): string }; createdAt?: Date };
  rentalId: string;
  bookingId: string;
  totals: OrderTotals;
  rates: { taxRate: number; processingRate: number };
  mixerLabel: (id: string) => string;
  resolvedMixers: string[];
  /** True when this call inserted a document rather than repricing one. */
  inserted: boolean;
}

export type CreateBookingResult =
  CreateBookingSuccess | { ok: false; status: 400 | 409; message: string };

/** The `Settings` document as this module reads it, through `.lean()`. */
type SettingsShape = {
  fees?: {
    deliveryFee?: number;
    salesTaxRate?: number;
    processingFeeRate?: number;
    serviceDiscountRate?: number;
    minOrderAmount?: number;
  };
  machines?: {
    single?: { basePrice: number };
    double?: { basePrice: number };
    triple?: { basePrice: number };
  };
  mixers?: Record<
    string,
    { price: number; label?: string; description?: string }
  >;
  extras?: Record<string, { price: number }>;
  operations?: {
    deliveryWindowStartHour?: number;
    deliveryWindowEndHour?: number;
  };
  // `.lean()` skips hydration, so `customFees` arrives as a plain object
  // rather than a Mongoose Map. `customFeeFor` reads either.
  deliveryZones?: DeliverySettings;
} | null;

/**
 * Validate, price and persist a booking.
 *
 * This is the whole of the customer checkout pipeline, shared by
 * `/api/save-booking` and the PayPal create-order route so the two cannot
 * drift on capacity derivation, catalog pricing, the service-area gate or the
 * oversell recheck. It owns the zod parse: every caller hands it a raw body.
 *
 * It deliberately does **not** rate-limit or build a `NextResponse` — limits
 * differ per route and a lib module minting a framework response is how the
 * two ended up coupled last time. Callers map `{ ok: false }` to their own
 * response.
 */
export async function createBooking(
  rentalDataInput: unknown,
  options: CreateBookingOptions,
): Promise<CreateBookingResult> {
  const parsed = rentalDataSchema.safeParse(rentalDataInput);
  if (!parsed.success) {
    return { ok: false, status: 400, message: firstIssueMessage(parsed.error) };
  }
  const rentalData = parsed.data;

  // Capacity is derived, never taken from the request: a mismatched
  // machineType/capacity pair used to match zero existing rentals and so
  // sailed past the availability check entirely.
  const capacity = MACHINE_CAPACITY[rentalData.machineType];

  // Connect to MongoDB
  await dbConnect();

  // Abandoned checkouts hold units indefinitely otherwise. The cron job is
  // the primary sweeper; this call keeps the booking path correct even if
  // the schedule is not configured.
  await releaseStaleHolds();

  // A reused hold is our own document, so it must not be counted against us.
  const existing = options.reuseBookingId
    ? await Rental.findOne({
        bookingId: options.reuseBookingId,
        status: "pending",
        "payment.status": { $ne: "completed" },
      })
    : null;

  // Inventory pre-check — refuse to persist the booking if all units of
  // this machine type are already booked for any day in the requested range.
  const availability = await isMachineAvailable(
    rentalData.machineType,
    capacity,
    rentalData.rentalDate,
    rentalData.returnDate,
    existing ? { excludeRentalId: existing._id.toString() } : undefined,
  );
  if (!availability.available) {
    return {
      ok: false,
      status: 409,
      message:
        availability.reason ??
        "This machine is no longer available for the selected dates. Please pick a different date or machine.",
    };
  }

  // Fetch admin settings so the booking total reflects any pricing overrides
  const settingsDoc = (await Settings.findOne({
    key: "global",
  }).lean()) as SettingsShape;

  // The delivery window and the service area were enforced only in the
  // browser (OrderForm/DetailsStep), so a direct POST could book a 03:00
  // delivery to any ZIP in the country. Both are re-checked below. The
  // service area is now the set of priced ZIPs rather than a hardcoded list,
  // and the surcharge rides on the same fact, so money IS at risk here in a
  // way it was not when delivery was one flat figure.
  const startHour = settingsDoc?.operations?.deliveryWindowStartHour ?? 8;
  const endHour = settingsDoc?.operations?.deliveryWindowEndHour ?? 18;
  for (const [label, time] of [
    ["Delivery", rentalData.rentalTime],
    ["Pickup", rentalData.returnTime],
  ] as const) {
    if (!validateDeliveryTime(time, startHour, endHour)) {
      return {
        ok: false,
        status: 400,
        message: `${label} time must be between ${startHour}:00 and ${endHour}:00`,
      };
    }
  }

  // The service-area gate and the surcharge are the same fact: `customFees`
  // is both the price list and the definition of the area. A ZIP nobody has
  // priced is REFUSED here rather than priced through `getDeliveryFee`'s
  // `?? 0`, which would hand out free delivery to an address no one agreed to
  // drive to. The browser refuses it first; this is the side of the wire that
  // is authoritative.
  const deliveryZones = settingsDoc?.deliveryZones;
  const feeResolution = resolveDeliveryFee(
    rentalData.customer.address.zipCode,
    deliveryZones,
  );
  if (!feeResolution.ok) {
    return { ok: false, status: 400, message: feeResolution.error };
  }

  // ── Authoritative server-side total ──────────────────────────────────
  // Reuses computeOrderTotal — the same function PricingSummary renders
  // for the customer — so the email, SMS, and DB payment.amount all match
  // exactly what was shown on the order page (including flat-priced extras,
  // admin extras-price overrides, and the service discount).
  const overrides: SettingsOverrides = {
    fees: settingsDoc?.fees,
    machines: settingsDoc?.machines,
    mixers: settingsDoc?.mixers,
    extras: settingsDoc?.extras,
    // Passing the zones rather than the resolved number keeps this call and
    // the browser's on one code path. `rentalSubtotalMirror.test.ts` is what
    // holds them equal; a cent of drift would refuse at the API what the
    // review screen had already approved, identically on every retry.
    deliveryZones,
  };

  // Add-ons are re-resolved against the server catalog, so name, price and
  // pricingType come from our data rather than the request body.
  const { extras: selectedExtras, unknownIds } = resolveSelectedExtras(
    rentalData.selectedExtras,
    { extras: settingsDoc?.extras, mixers: settingsDoc?.mixers },
  );
  if (unknownIds.length > 0) {
    return {
      ok: false,
      status: 400,
      message: "One or more selected extras are not available",
    };
  }

  // Tank mixers are re-resolved the same way. The set of valid flavours is
  // whatever `Settings.mixers` holds, so a flavour an admin adds is a real,
  // bookable choice rather than a card that 400s at checkout.
  const { mixers: resolvedMixers, unknownIds: unknownMixerIds } =
    resolveSelectedMixers(rentalData.selectedMixers, {
      extras: settingsDoc?.extras,
      mixers: settingsDoc?.mixers,
    });
  if (unknownMixerIds.length > 0) {
    return {
      ok: false,
      status: 400,
      message: "One or more selected mixers are not available",
    };
  }

  /** Display label for a mixer id, including admin-added flavours. */
  const mixerLabel = (id: string): string =>
    settingsDoc?.mixers?.[id]?.label ??
    mixerDetails[id as keyof typeof mixerDetails]?.label ??
    id;

  const totals = computeOrderTotal(
    {
      machineType: rentalData.machineType,
      selectedMixers: resolvedMixers,
      selectedExtras,
      rentalDate: rentalData.rentalDate,
      returnDate: rentalData.returnDate,
      // The times price the specific-time charge. Omitting them reads as
      // "flexible" and would bill $0 for a leg the browser quoted as pinned.
      rentalTime: rentalData.rentalTime,
      returnTime: rentalData.returnTime,
      // The surcharge is resolved from this ZIP inside `computeOrderTotal`.
      // Omitting the customer here would leave it with no ZIP to price and
      // silently deliver for $0.
      customer: rentalData.customer,
      // The service discount was retired from the product. It is applied by
      // hand at invoicing time for legacy cases and is never client-settable.
      isServiceDiscount: false,
    } as OrderFormData,
    overrides,
  );

  const finalTotal = totals.finalTotal;

  // The floor is measured on rentals alone, never on `finalTotal`. The
  // surcharge is the cost the minimum exists to cover, so it must not be what
  // clears it — otherwise a $92 cart qualifies for a $100 floor by being
  // delivered somewhere expensive.
  const minimumOrderAmount = minimumForZip(
    rentalData.customer.address.zipCode,
    deliveryZones,
    settingsDoc?.fees?.minOrderAmount ?? 0,
  );
  if (minimumOrderAmount > 0 && totals.rentalSubtotal < minimumOrderAmount) {
    return {
      ok: false,
      status: 400,
      message: minimumOrderError(
        minimumOrderAmount,
        rentalData.customer.address.zipCode,
        totals.rentalSubtotal,
      ),
    };
  }

  const rates = {
    taxRate: settingsDoc?.fees?.salesTaxRate ?? 0.0825,
    processingRate: settingsDoc?.fees?.processingFeeRate ?? 0.03,
  };
  // ─────────────────────────────────────────────────────────────────────

  const customer = {
    name: rentalData.customer.name,
    email: rentalData.customer.email,
    phone: rentalData.customer.phone,
    address: {
      street: rentalData.customer.address.street,
      city: rentalData.customer.address.city,
      state: rentalData.customer.address.state,
      zipCode: rentalData.customer.address.zipCode,
    },
  };

  // ── Reuse branch ─────────────────────────────────────────────────────
  // The buyer came back to a hold they already own. Reprice it in place
  // rather than inserting a second document holding a second unit. The
  // availability check above already excluded it, and no oversell recheck is
  // needed because no new unit is being claimed.
  if (existing) {
    existing.machineType = rentalData.machineType;
    existing.capacity = capacity;
    existing.selectedMixers = resolvedMixers;
    existing.selectedExtras = selectedExtras;
    existing.price = finalTotal;
    existing.rentalDate = rentalData.rentalDate;
    existing.rentalTime = rentalData.rentalTime;
    existing.returnDate = rentalData.returnDate;
    existing.returnTime = rentalData.returnTime;
    existing.customer = customer;
    existing.notes = rentalData.notes;
    existing.payment = {
      paypalTransactionId: null,
      amount: finalTotal,
      status: "pending",
      date: new Date(),
    };
    const resaved = await existing.save();

    return {
      ok: true,
      rental: existing,
      savedRental: resaved,
      rentalId: resaved._id.toString(),
      bookingId: existing.bookingId,
      totals,
      rates,
      mixerLabel,
      resolvedMixers,
      inserted: false,
    };
  }

  // Generate a unique booking ID
  const bookingId = nanoid(10).toUpperCase();

  // Built field by field rather than spreading the request body: `price`
  // used to be whatever the browser computed, which could disagree with the
  // server-side `payment.amount` sitting right beside it.
  const rental = new Rental({
    machineType: rentalData.machineType,
    capacity,
    selectedMixers: resolvedMixers,
    selectedExtras,
    price: finalTotal,
    rentalDate: rentalData.rentalDate,
    rentalTime: rentalData.rentalTime,
    returnDate: rentalData.returnDate,
    returnTime: rentalData.returnTime,
    customer,
    notes: rentalData.notes,
    isServiceDiscount: false,
    bookingId,
    status: options.status,
    payment: {
      paypalTransactionId: null, // No PayPal transaction yet
      amount: finalTotal,
      status: "pending",
      date: new Date(),
    },
  });

  const savedRental = await rental.save();

  // The check above and this write are not atomic, so two concurrent
  // requests could both claim the last unit. Re-count now that our own hold
  // is persisted (excluding it), and roll back if we oversold.
  //
  // `ignoreCreatedFrom` makes that recheck asymmetric: only holds that
  // already existed when ours landed can displace us. A symmetric recheck
  // had both racers roll themselves back, rejecting two real customers and
  // leaving the unit unsold.
  const recheck = await isMachineAvailable(
    rentalData.machineType,
    capacity,
    rentalData.rentalDate,
    rentalData.returnDate,
    {
      excludeRentalId: savedRental._id.toString(),
      ignoreCreatedFrom: savedRental.createdAt ?? new Date(),
      // `createdAt` is millisecond-resolution, so two requests built in the
      // same tick each fell outside the other's cutoff and both survived.
      tieBreakId: savedRental._id.toString(),
    },
  );
  if (!recheck.available) {
    // The compensating delete is the only thing standing between a losing
    // racer and an oversold unit. If it throws, the caller's outer catch
    // returns a generic 500 and the rental stays in the collection holding
    // inventory, indistinguishable in the logs from any other failure — so it
    // gets its own marker an operator can alert on.
    try {
      await Rental.deleteOne({ _id: savedRental._id });
    } catch (rollbackError) {
      console.error("OVERSELL_ROLLBACK_FAILED", {
        rentalId: savedRental._id.toString(),
        bookingId: savedRental.bookingId,
        reason:
          rollbackError instanceof Error ? rollbackError.name : "UnknownError",
      });
      throw rollbackError;
    }
    return {
      ok: false,
      status: 409,
      message:
        recheck.reason ??
        "This machine was just booked for the selected dates. Please pick a different date or machine.",
    };
  }

  return {
    ok: true,
    rental,
    savedRental,
    rentalId: savedRental._id.toString(),
    bookingId,
    totals,
    rates,
    mixerLabel,
    resolvedMixers,
    inserted: true,
  };
}
