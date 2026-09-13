import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { STALE_HOLD_MINUTES, isMachineAvailable } from "@/lib/inventory";
import { safeErrorSummary } from "@/lib/safe-error";
import { guardPublicWrite } from "@/lib/api-guard";
import { sendBookingNotifications } from "@/lib/booking/notify";
import {
  INSTRUMENT_DECLINED,
  ORDER_ALREADY_CAPTURED,
  PAYER_ACTION_REQUIRED,
  TRANSACTION_REFUSED,
  PayPalError,
  capturePayPalOrder,
  firstCapture,
  getPayPalOrder,
  paypalConfigured,
  payPalErrorDetail,
  type PayPalCapture,
} from "@/lib/paypal/client";
import { mixerDetails } from "@/lib/rental-data";
import {
  computeOrderTotal,
  type SettingsOverrides,
} from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";
import type { DeliverySettings } from "@/lib/delivery/zones";
import { firstIssueMessage, paypalCaptureSchema } from "@/lib/validation";

/** `Settings` as this route reads it, through `.lean()`. */
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

/**
 * Take the money for an approved PayPal order and confirm the booking.
 *
 * The body carries **only** the order id. The amount is read back from PayPal
 * and checked against the price this server stored when it opened the order —
 * the same rule `/api/save-booking` follows, that a request body is never a
 * source of money.
 */
export async function POST(request: Request) {
  // Set once a capture has actually happened. Distinguishes "we failed before
  // touching the buyer's money" from the one failure that needs an operator.
  let capturedId: string | null = null;

  try {
    // Deliberately looser than the other public writes. A 429 here happens
    // after PayPal has approved the payment, which is the worst outcome this
    // flow has; a buyer legitimately makes one or two capture calls.
    const guard = await guardPublicWrite(request, {
      route: "paypal-capture",
      limit: 20,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    if (!paypalConfigured()) {
      return NextResponse.json(
        { message: "Online payment is temporarily unavailable." },
        { status: 503 },
      );
    }

    const parsed = paypalCaptureSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { orderId } = parsed.data;

    await dbConnect();
    const rental = await Rental.findOne({ paypalOrderId: orderId });
    if (!rental) {
      return NextResponse.json(
        { message: "We could not find that booking." },
        { status: 404 },
      );
    }

    // ── Pre-flight, all of it before any PayPal call ─────────────────────
    // Refusing here is enormously better than capturing and then owing a
    // refund against copy that says all sales are final.

    // Already paid. Idempotent: no second capture, no second email.
    if (rental.payment?.status === "completed") {
      return NextResponse.json({
        bookingId: rental.bookingId,
        settled: rental.status === "confirmed",
        amount: rental.payment?.amount ?? (rental.price as number),
      });
    }

    // The reaper cancels abandoned holds. Capturing against one would take
    // money for a unit we have already put back on sale.
    if (rental.status === "cancelled") {
      return NextResponse.json(
        {
          message:
            "This booking expired before payment was completed. Please start again.",
        },
        { status: 409 },
      );
    }

    // A buyer can approve long after the hold stopped counting toward
    // inventory, by which point someone else may hold the unit.
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
        return NextResponse.json(
          {
            message:
              stillAvailable.reason ??
              "This machine was booked while your payment was open. Nothing has been charged.",
          },
          { status: 409 },
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    let capture: PayPalCapture | null;
    try {
      capture = firstCapture(await capturePayPalOrder(orderId));
    } catch (error) {
      // A funding source saying no is not a failure of ours, and nothing has
      // been charged. PayPal reports it as a 422 here rather than as a `201`
      // carrying a DECLINED capture — both shapes are real, and this one used
      // to fall through to the generic 502 that tells the buyer to phone us
      // while a good second card is in their hand. The hold stays `pending`,
      // so a retry reprices it rather than taking another unit.
      if (error instanceof PayPalError) {
        if (
          error.issue === INSTRUMENT_DECLINED ||
          error.issue === TRANSACTION_REFUSED
        ) {
          return NextResponse.json(
            {
              message: "That payment was declined. Please try another method.",
            },
            { status: 402 },
          );
        }
        if (error.issue === PAYER_ACTION_REQUIRED) {
          return NextResponse.json(
            {
              message:
                "PayPal needs you to confirm this payment. Please try again.",
            },
            { status: 402 },
          );
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
      return NextResponse.json(
        { message: "PayPal did not confirm the payment. Please try again." },
        { status: 502 },
      );
    }

    if (capture.status === "DECLINED" || capture.status === "FAILED") {
      // The hold stays `pending`, so the buyer can pick another funding
      // source without losing their place in the queue.
      return NextResponse.json(
        { message: "That payment was declined. Please try another method." },
        { status: 402 },
      );
    }

    capturedId = capture.id;

    // Always against the STORED price. Settings can change between opening
    // the order and capturing it, and a booking keeps the price it was sold
    // at — so a recompute here would compare PayPal's figure against a number
    // nobody was ever quoted.
    const expected = (rental.price as number).toFixed(2);
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

    // `PENDING` is PayPal holding the funds for review (eCheck, risk). The
    // money is committed either way, so a non-settled capture must still
    // leave `pending` for `pending_payment`, which is never reaped.
    const settled = capture.status === "COMPLETED" && amountMatches;

    // What PayPal actually took. On the settled path this is `rental.price` by
    // construction — `amountMatches` is what `settled` is partly made of — so
    // the happy path is unchanged. On a mismatch it stops the record claiming
    // we collected a figure nobody paid, which is what QuickBooks reconciles
    // against.
    const capturedAmount = Number(capture.amount?.value);
    const recordedAmount = Number.isFinite(capturedAmount)
      ? capturedAmount
      : (rental.price as number);

    // The write **is** the claim. Two concurrent approvals both read
    // `payment.status: "pending"` above, so only the update that actually
    // matched may send the confirmation.
    //
    // Dotted `$set` paths, never `payment: {...}`, which would drop fields.
    // No `runValidators` — under a query update Mongoose binds `this` to the
    // Query, which is the documented 500 this repo already paid for.
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
      return NextResponse.json({
        bookingId: rental.bookingId,
        settled,
        amount: recordedAmount,
      });
    }

    // Sent on **both** branches. A capture that has not settled has still
    // moved the buyer's money, and it used to notify nobody at all: no
    // confirmation, no operator SMS, only a console line — while the browser
    // read the bare 200 as a win and told the customer they were paid in full.
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
        // Only when it differs: the operator SMS prints it as a discrepancy,
        // and there is no discrepancy on the settled path.
        ...(amountMatches ? {} : { capturedAmount: recordedAmount }),
      },
    });

    // `settled` and `amount` are what let the browser tell the customer the
    // truth rather than reading every 200 as "paid in full".
    return NextResponse.json({
      bookingId: won.bookingId,
      settled,
      amount: recordedAmount,
    });
  } catch (error) {
    if (capturedId) {
      // PayPal took the money and our write then threw. The route is
      // idempotent, so a retry heals it — this marker is what makes the case
      // findable when no retry comes.
      console.error("PAYPAL_CAPTURE_ORPHANED", {
        captureId: capturedId,
        reason: safeErrorSummary(error),
      });
    } else {
      const detail = payPalErrorDetail(error);
      console.error("Error capturing PayPal order:", {
        issue: detail?.issue,
        debugId: detail?.debugId,
        status: detail?.status,
        reason: safeErrorSummary(error),
      });
    }

    return NextResponse.json(
      {
        message:
          "We could not confirm your payment. Please call us before trying again.",
      },
      { status: 502 },
    );
  }
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
      customer: rental.customer,
      isServiceDiscount: false,
    } as OrderFormData,
    overrides,
  );
  // The stored price is what was charged, so it is what the email must say.
  return { ...totals, finalTotal: rental.price as number };
}
