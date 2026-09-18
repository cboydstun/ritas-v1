import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { STALE_HOLD_MINUTES, isMachineAvailable } from "@/lib/inventory";
import { sendBookingNotifications } from "@/lib/booking/notify";
import { schedulePartnerEvent } from "@/lib/partner/send";
import type { PartnerRentalLike } from "@/lib/partner/payload";
import { safeErrorSummary } from "@/lib/safe-error";
import {
  INSTRUMENT_DECLINED,
  ORDER_ALREADY_CAPTURED,
  PAYER_ACTION_REQUIRED,
  TRANSACTION_REFUSED,
  PayPalError,
  capturePayPalOrder,
  firstCapture,
  getPayPalOrder,
  type PayPalCapture,
} from "@/lib/paypal/client";
import { mixerDetails } from "@/lib/rental-data";
import {
  computeOrderTotal,
  type SettingsOverrides,
} from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";
import type { DeliverySettings } from "@/lib/delivery/zones";
import type { MachineType } from "@/types";

/**
 * Taking the money for an approved PayPal order, with no HTTP in it.
 *
 * Extracted from `/api/v1/paypal/capture-order` because the webhook needs the
 * same thing: `CHECKOUT.ORDER.APPROVED` arrives precisely when the buyer's
 * browser never came back to capture, and it must apply the identical
 * pre-flight refusals. Two implementations of "should we take this money"
 * would be two answers to it.
 *
 * Returns a discriminated result and **never** a `NextResponse`, the same
 * contract `createBooking` keeps: limits and copy belong to the caller, and a
 * lib module minting a framework response is how those ended up coupled last
 * time.
 */

/** `Settings` as this module reads it, through `.lean()`. */
type SettingsShape = {
  fees?: {
    deliveryFee?: number;
    salesTaxRate?: number;
    processingFeeRate?: number;
    minOrderAmount?: number;
  };
  machines?: Record<string, { basePrice: number }>;
  mixers?: Record<string, { price: number; label?: string }>;
  extras?: Record<string, { price: number }>;
  deliveryZones?: DeliverySettings;
} | null;

/** The persisted rental, as much of it as this module touches. */
type RentalDoc = Record<string, unknown> & {
  _id: { toString(): string };
  bookingId: string;
  price: number;
  status: string;
  capacity: 15 | 30 | 45;
  machineType: MachineType;
  rentalDate: string;
  returnDate: string;
  createdAt?: Date;
  selectedMixers?: string[];
  payment?: { status?: string; amount?: number };
};

export type CaptureResult =
  | { ok: true; bookingId: string; settled: boolean; amount: number }
  | { ok: false; status: 402 | 404 | 409 | 502; message: string };

/**
 * Verify a capture against the booking, claim it, and notify.
 *
 * Shared by the capture route and the webhook's `PAYMENT.CAPTURE.COMPLETED`
 * branch — the latter has a capture PayPal has already taken and must not take
 * again, which is why this half is separable from the call that captures.
 */
export async function settleCapturedBooking(
  rental: RentalDoc,
  capture: PayPalCapture,
): Promise<CaptureResult> {
  // Always against the STORED price. Settings can change between opening the
  // order and capturing it, and a booking keeps the price it was sold at — so
  // a recompute here would compare PayPal's figure against a number nobody
  // was ever quoted.
  const expected = rental.price.toFixed(2);
  const amountMatches =
    capture.amount?.value === expected &&
    capture.amount?.currency_code === "USD";

  if (!amountMatches) {
    console.error("PAYPAL_AMOUNT_MISMATCH", {
      bookingId: rental.bookingId,
      expected,
      captured: capture.amount?.value,
      currency: capture.amount?.currency_code,
    });
  }

  // `PENDING` is PayPal holding the funds for review (eCheck, risk). The money
  // is committed either way, so a non-settled capture must still leave
  // `pending` for `pending_payment`, which is never reaped.
  const settled = capture.status === "COMPLETED" && amountMatches;

  // What PayPal actually took. On the settled path this is `rental.price` by
  // construction — `amountMatches` is what `settled` is partly made of — so
  // the happy path is unchanged. On a mismatch it stops the record claiming we
  // collected a figure nobody paid, which is what QuickBooks reconciles
  // against.
  const capturedAmount = Number(capture.amount?.value);
  const recordedAmount = Number.isFinite(capturedAmount)
    ? capturedAmount
    : rental.price;

  // Everything from here on runs with the buyer's money already taken, which
  // is the one failure that needs an operator rather than a retry. The marker
  // lives here rather than in the calling route because this is the only scope
  // that knows a capture happened.
  try {
    return await claimAndNotify(rental, capture, {
      settled,
      amountMatches,
      recordedAmount,
    });
  } catch (error) {
    // PayPal took the money and our write then threw. Both callers are
    // idempotent, so a retry heals it — this marker is what makes the case
    // findable when no retry comes.
    console.error("PAYPAL_CAPTURE_ORPHANED", {
      captureId: capture.id,
      reason: safeErrorSummary(error),
    });
    throw error;
  }
}

/** The write and the two notifications, once the money is known to have moved. */
async function claimAndNotify(
  rental: RentalDoc,
  capture: PayPalCapture,
  {
    settled,
    amountMatches,
    recordedAmount,
  }: { settled: boolean; amountMatches: boolean; recordedAmount: number },
): Promise<CaptureResult> {
  // The write **is** the claim. Two concurrent approvals both read
  // `payment.status: "pending"` above, so only the update that actually
  // matched may send the confirmation. It is also what makes a redelivered
  // webhook inert.
  //
  // Dotted `$set` paths, never `payment: {...}`, which would drop fields. No
  // `runValidators` — under a query update Mongoose binds `this` to the Query,
  // which is the documented 500 this repo already paid for.
  const won = await Rental.findOneAndUpdate(
    { _id: rental._id, "payment.status": { $ne: "completed" } },
    {
      $set: {
        status: settled ? "confirmed" : "pending_payment",
        "payment.paypalTransactionId": capture.id,
        "payment.status": settled ? "completed" : "pending",
        "payment.amount": recordedAmount,
        "payment.date": new Date(),
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!won) {
    return {
      ok: true,
      bookingId: rental.bookingId,
      settled,
      amount: recordedAmount,
    };
  }

  // Sent on **both** branches. A capture that has not settled has still moved
  // the buyer's money, and it used to notify nobody at all: no confirmation,
  // no operator SMS, only a console line — while the browser read the bare 200
  // as a win and told the customer they were paid in full.
  const settings = (await Settings.findOne({
    key: "global",
  }).lean()) as SettingsShape;

  await sendBookingNotifications({
    rental: won,
    bookingId: won.bookingId,
    totals: rebuildTotals(won, settings),
    rates: {
      taxRate: settings?.fees?.salesTaxRate ?? 0.0825,
      processingRate: settings?.fees?.processingFeeRate ?? 0.03,
    },
    mixerLabel: (id: string) =>
      settings?.mixers?.[id]?.label ??
      mixerDetails[id as keyof typeof mixerDetails]?.label ??
      id,
    resolvedMixers: won.selectedMixers ?? [],
    payment: {
      paid: true,
      settled,
      transactionId: capture.id,
      method: "paypal",
      // Only when it differs: the operator SMS prints it as a discrepancy, and
      // there is no discrepancy on the settled path.
      ...(amountMatches ? {} : { capturedAmount: recordedAmount }),
    },
  });

  // bounce-v3 has not seen this booking before: the PayPal hold was written as
  // `pending`, which is never emitted, so the shared calendar learns about it
  // only once money has actually moved. `order.created`, not an update.
  //
  // The totals are the rebuilt ones, which pin `finalTotal` to the STORED
  // price — the same reason the amount check above does. Rebuilding from
  // today's settings would send a figure nobody was quoted.
  schedulePartnerEvent({
    event: "order.created",
    partnerOrderId: String(won._id),
    bookingId: won.bookingId,
    rental: won as unknown as PartnerRentalLike,
    totals: rebuildTotals(won, settings),
    resolvedMixers: won.selectedMixers ?? [],
    mixerLabel: (id: string) =>
      settings?.mixers?.[id]?.label ??
      mixerDetails[id as keyof typeof mixerDetails]?.label ??
      id,
    status: settled ? "confirmed" : "pending_payment",
    paymentStatus: settled ? "completed" : "pending",
    paymentMethod: "paypal",
    capturedAmount: recordedAmount,
  });

  return {
    ok: true,
    bookingId: won.bookingId,
    settled,
    amount: recordedAmount,
  };
}

/**
 * Capture an approved PayPal order and confirm the booking behind it.
 *
 * The caller supplies only an order id. The amount is read back from PayPal
 * and checked against the price this server stored when it opened the order —
 * the same rule `/api/save-booking` follows, that a request body is never a
 * source of money.
 *
 * Throws only for failures that are genuinely unknown; every refusal comes
 * back as `{ ok: false }` with the status the caller should answer.
 */
export async function capturePayPalBooking(
  orderId: string,
): Promise<CaptureResult> {
  await dbConnect();
  const rental = (await Rental.findOne({
    paypalOrderId: orderId,
  })) as RentalDoc | null;
  if (!rental) {
    return {
      ok: false,
      status: 404,
      message: "We could not find that booking.",
    };
  }

  // ── Pre-flight, all of it before any PayPal call ──────────────────────
  // Refusing here is enormously better than capturing and then owing a refund
  // against copy that says all sales are final.

  // Already paid. Idempotent: no second capture, no second email. This is also
  // what absorbs a redelivered `CHECKOUT.ORDER.APPROVED`.
  if (rental.payment?.status === "completed") {
    return {
      ok: true,
      bookingId: rental.bookingId,
      settled: rental.status === "confirmed",
      amount: rental.payment?.amount ?? rental.price,
    };
  }

  // The reaper cancels abandoned holds. Capturing against one would take money
  // for a unit we have already put back on sale.
  if (rental.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      message:
        "This booking expired before payment was completed. Please start again.",
    };
  }

  // A buyer can approve long after the hold stopped counting toward inventory,
  // by which point someone else may hold the unit.
  const createdAt: Date = rental.createdAt ?? new Date();
  const holdExpired =
    Date.now() - createdAt.getTime() >= STALE_HOLD_MINUTES * 60 * 1000;
  if (holdExpired) {
    const stillAvailable = await isMachineAvailable(
      rental.machineType,
      rental.capacity,
      rental.rentalDate,
      rental.returnDate,
      { excludeRentalId: rental._id.toString() },
    );
    if (!stillAvailable.available) {
      return {
        ok: false,
        status: 409,
        message:
          stillAvailable.reason ??
          "This machine was booked while your payment was open. Nothing has been charged.",
      };
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  let capture: PayPalCapture | null;
  try {
    capture = firstCapture(await capturePayPalOrder(orderId));
  } catch (error) {
    // A funding source saying no is not a failure of ours, and nothing has
    // been charged. PayPal reports it as a 422 here rather than as a `201`
    // carrying a DECLINED capture — both shapes are real, and this one used to
    // fall through to the generic 502 that tells the buyer to phone us while a
    // good second card is in their hand. The hold stays `pending`, so a retry
    // reprices it rather than taking another unit.
    if (error instanceof PayPalError) {
      if (
        error.issue === INSTRUMENT_DECLINED ||
        error.issue === TRANSACTION_REFUSED
      ) {
        return {
          ok: false,
          status: 402,
          message: "That payment was declined. Please try another method.",
        };
      }
      if (error.issue === PAYER_ACTION_REQUIRED) {
        return {
          ok: false,
          status: 402,
          message:
            "PayPal needs you to confirm this payment. Please try again.",
        };
      }
    }

    // `ORDER_ALREADY_CAPTURED` is the expected answer to a retry, and a
    // timeout is an unknown rather than a failure. Both are resolved by
    // reading the order back — never by re-POSTing a capture blind.
    const recoverable =
      (error instanceof PayPalError &&
        error.issue === ORDER_ALREADY_CAPTURED) ||
      (error instanceof Error && error.name === "TimeoutError");
    if (!recoverable) throw error;

    capture = firstCapture(await getPayPalOrder(orderId));
    if (!capture) throw error;
  }

  if (!capture) {
    return {
      ok: false,
      status: 502,
      message: "PayPal did not confirm the payment. Please try again.",
    };
  }

  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    // The hold stays `pending`, so the buyer can pick another funding source
    // without losing their place in the queue.
    return {
      ok: false,
      status: 402,
      message: "That payment was declined. Please try another method.",
    };
  }

  return settleCapturedBooking(rental, capture);
}

/**
 * The line-item breakdown for the confirmation email.
 *
 * Recomputed from the stored booking rather than persisted, because only the
 * total is authoritative — and the total printed is `rental.price`, not this.
 * A settings change between opening and capturing an order can move a line by
 * a cent; it cannot move what the customer was charged.
 */
function rebuildTotals(
  rental: Record<string, unknown>,
  settings: SettingsShape,
) {
  const overrides: SettingsOverrides = {
    fees: settings?.fees,
    machines: settings?.machines as SettingsOverrides["machines"],
    mixers: settings?.mixers,
    extras: settings?.extras,
    deliveryZones: settings?.deliveryZones,
  };
  const totals = computeOrderTotal(
    {
      machineType: rental.machineType,
      selectedMixers: rental.selectedMixers ?? [],
      selectedExtras: rental.selectedExtras ?? [],
      rentalDate: rental.rentalDate,
      returnDate: rental.returnDate,
      // Without the times the email and partner payload would itemise no
      // specific-time charge against a stored price that includes one.
      rentalTime: rental.rentalTime,
      returnTime: rental.returnTime,
      customer: rental.customer,
      isServiceDiscount: false,
    } as OrderFormData,
    overrides,
  );
  // The stored price is what was charged, so it is what the email must say.
  return { ...totals, finalTotal: rental.price as number };
}
