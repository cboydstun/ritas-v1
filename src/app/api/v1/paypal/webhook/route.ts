import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { safeErrorSummary } from "@/lib/safe-error";
import { guardPublicWrite } from "@/lib/api-guard";
import {
  capturePayPalBooking,
  settleCapturedBooking,
} from "@/lib/booking/capturePayPalBooking";
import { schedulePartnerEvent } from "@/lib/partner/send";
import type { PartnerRentalLike } from "@/lib/partner/payload";
import {
  sendOperatorSms,
  sendPaymentFailedNotification,
  settleOperatorSms,
} from "@/lib/booking/notify";
import {
  payPalErrorDetail,
  paypalWebhookConfigured,
  verifyWebhookSignature,
} from "@/lib/paypal/client";

/**
 * PayPal's side of the conversation.
 *
 * Everything else in the checkout depends on the buyer's browser still being
 * there. This route is what speaks when it is not: an approval whose capture
 * call never came, and an eCheck capture PayPal finishes clearing days later.
 * Neither has any other channel.
 *
 * The route is public and unauthenticated — PayPal will not carry a secret of
 * ours — so the signature check *is* the authentication, and it runs before
 * any read, capture or write. Anything claiming a payment settled is hostile
 * until PayPal itself confirms it sent the message.
 */

/** Only the parts of a webhook event this route reads. */
type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

export async function POST(request: Request) {
  try {
    // Deliberately generous. PayPal retries with backoff from varying IPs and
    // a 429 loses the event outright; the signature is the real gate, and this
    // only bounds the outbound verify call each request costs us.
    const guard = await guardPublicWrite(request, {
      route: "paypal-webhook",
      limit: 120,
      windowSeconds: 60,
    });
    if (!guard.ok) return guard.response;

    if (!paypalWebhookConfigured()) {
      // Dark without the env var, like the rest of the PayPal feature. 503 and
      // not 200: PayPal should retry once this is configured rather than treat
      // the event as delivered.
      console.error("PAYPAL_WEBHOOK_UNCONFIGURED");
      return NextResponse.json(
        { message: "Webhook not configured." },
        { status: 503 },
      );
    }

    const event = guard.data as WebhookEvent;

    // ── Authentication ───────────────────────────────────────────────────
    // A throw here is NOT a refusal. Our own credential being rejected, a
    // timeout or a PayPal 5xx all mean we do not know whether this event is
    // genuine — and discarding a real paid-order notification during a
    // credential blip would leave a customer's money taken and their booking
    // unconfirmed. Answer 5xx so PayPal redelivers.
    let verified: boolean;
    try {
      verified = await verifyWebhookSignature(request.headers, event);
    } catch (error) {
      const detail = payPalErrorDetail(error);
      console.error("PAYPAL_WEBHOOK_VERIFY_FAILED", {
        eventType: event?.event_type,
        issue: detail?.issue,
        debugId: detail?.debugId,
        status: detail?.status,
        reason: safeErrorSummary(error),
      });
      return NextResponse.json(
        { message: "Could not verify the event. Please retry." },
        { status: 503 },
      );
    }

    if (!verified) {
      console.error("PAYPAL_WEBHOOK_UNVERIFIED", {
        eventType: event?.event_type,
        eventId: event?.id,
      });
      return NextResponse.json(
        { message: "Invalid signature." },
        { status: 401 },
      );
    }
    // ─────────────────────────────────────────────────────────────────────

    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED":
        return await handleApproved(event);
      case "PAYMENT.CAPTURE.COMPLETED":
        return await handleCaptureCompleted(event);
      case "PAYMENT.CAPTURE.DENIED":
        return await handleCaptureDenied(event);
      case "PAYMENT.CAPTURE.REFUNDED":
        return await handleRefunded(event);
      default:
        // 200, not 4xx: PayPal retries a non-2xx for days, and an event type
        // we will never handle is not a failure. A subscription can also be
        // widened in the dashboard without a deploy here.
        console.log("PAYPAL_WEBHOOK_IGNORED", {
          eventType: event.event_type,
        });
        return NextResponse.json({ ignored: true });
    }
  } catch (error) {
    // 5xx so PayPal redelivers. Both capture paths are idempotent, so a
    // redelivery after a partial failure heals rather than double-charges.
    console.error("PAYPAL_WEBHOOK_ERROR", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Webhook handling failed." },
      { status: 500 },
    );
  }
}

/** The order id a capture event carries, which is our own lookup key. */
function orderIdOf(event: WebhookEvent): string | undefined {
  return event.resource?.supplementary_data?.related_ids?.order_id;
}

/**
 * The buyer approved and their browser never came back to capture.
 *
 * `capturePayPalBooking` applies every pre-flight refusal the customer-facing
 * route does, which is the point of calling it rather than capturing here: an
 * expired hold whose machine has since gone must not be captured, or the
 * webhook takes money for a unit already sold to someone else.
 */
async function handleApproved(event: WebhookEvent) {
  const orderId = event.resource?.id;
  if (!orderId) return NextResponse.json({ ignored: true });

  const result = await capturePayPalBooking(orderId);
  if (!result.ok) {
    // Logged, then 200: these are decisions, not failures, and redelivering
    // will reach the same one. A booking we do not recognise is the normal
    // case for PayPal's webhook simulator.
    console.log("PAYPAL_WEBHOOK_APPROVED_REFUSED", {
      orderId,
      status: result.status,
    });
    return NextResponse.json({ handled: false });
  }

  console.log("PAYPAL_WEBHOOK_APPROVED_CAPTURED", {
    bookingId: result.bookingId,
    settled: result.settled,
  });
  return NextResponse.json({ bookingId: result.bookingId });
}

/**
 * A capture cleared — the eCheck promotion.
 *
 * The money was already taken when the capture was made; this event says it
 * has now settled. So it must **not** capture again, only re-run the
 * verification and the claim, which is why `settleCapturedBooking` is
 * separable. The stored price is still what the amount is checked against; the
 * event body is never a source of money.
 */
async function handleCaptureCompleted(event: WebhookEvent) {
  const orderId = orderIdOf(event);
  const captureId = event.resource?.id;
  if (!orderId || !captureId) return NextResponse.json({ ignored: true });

  await dbConnect();
  const rental = await Rental.findOne({ paypalOrderId: orderId });
  if (!rental) return NextResponse.json({ handled: false });

  // Already settled. The conditional claim inside `settleCapturedBooking`
  // would absorb this anyway; returning early saves a Settings read and a
  // wasted notification build on every redelivery.
  if (rental.payment?.status === "completed") {
    return NextResponse.json({ bookingId: rental.bookingId });
  }

  const result = await settleCapturedBooking(rental, {
    id: captureId,
    status: event.resource?.status ?? "COMPLETED",
    amount: event.resource?.amount as
      { value: string; currency_code: string } | undefined,
  });

  console.log("PAYPAL_WEBHOOK_CAPTURE_SETTLED", {
    bookingId: result.ok ? result.bookingId : undefined,
  });
  return NextResponse.json({ handled: result.ok });
}

/**
 * A capture PayPal was clearing has failed.
 *
 * No money arrived, so the unit goes back on sale — and the customer is told,
 * because they are holding an email that says the payment is clearing. Taking
 * someone's date away in silence is the worse of the two failures.
 *
 * The update is filtered on the status it expects to find, so a redelivery
 * matches nothing and nobody is emailed twice.
 */
async function handleCaptureDenied(event: WebhookEvent) {
  const orderId = orderIdOf(event);
  const captureId = event.resource?.id;
  if (!orderId || !captureId) return NextResponse.json({ ignored: true });

  await dbConnect();
  const released = await Rental.findOneAndUpdate(
    {
      paypalOrderId: orderId,
      "payment.status": { $nin: ["completed", "failed", "refunded"] },
    },
    {
      $set: {
        status: "cancelled",
        "payment.status": "failed",
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!released) return NextResponse.json({ handled: false });

  await sendPaymentFailedNotification({
    rental: released,
    bookingId: released.bookingId,
    transactionId: captureId,
  });

  // The unit is back on sale here, so the shared calendar has to hear about it
  // or the crew keeps a slot reserved for a booking that no longer exists.
  schedulePartnerEvent({
    event: "order.cancelled",
    partnerOrderId: String(released._id),
    bookingId: released.bookingId,
    rental: released as unknown as PartnerRentalLike,
    status: "cancelled",
    paymentStatus: "failed",
    paymentMethod: "paypal",
  });

  console.log("PAYPAL_WEBHOOK_CAPTURE_DENIED", {
    bookingId: released.bookingId,
  });
  return NextResponse.json({ bookingId: released.bookingId });
}

/**
 * A refund was issued from the PayPal dashboard.
 *
 * **Recorded, never acted on.** The booking stops reading `completed` when
 * PayPal says the money went back, which is the gap a real refund exposed —
 * but the rental status is left alone deliberately. A partial refund, or a
 * goodwill gesture on a rental that is still going ahead, must not put the
 * machine back on sale behind the operator's back.
 */
async function handleRefunded(event: WebhookEvent) {
  const orderId = orderIdOf(event);
  if (!orderId) return NextResponse.json({ ignored: true });

  await dbConnect();
  const refunded = await Rental.findOneAndUpdate(
    { paypalOrderId: orderId, "payment.status": { $ne: "refunded" } },
    { $set: { "payment.status": "refunded", updatedAt: new Date() } },
    { new: true },
  );
  if (!refunded) return NextResponse.json({ handled: false });

  const amount = event.resource?.amount?.value;
  const sms = sendOperatorSms(
    `💸 REFUND RECORDED\n` +
      `Booking ID: ${refunded.bookingId}\n` +
      `Date: ${refunded.rentalDate}\n` +
      `Refunded: ${amount ? `$${amount}` : "see PayPal"}\n` +
      `The booking status is unchanged — cancel it in the admin if the rental is off.`,
  );
  await settleOperatorSms(sms);

  // `order.updated`, never a cancellation — the rental status is deliberately
  // untouched here, and a refund on a booking that is still going ahead must
  // not take it off the shared calendar either.
  schedulePartnerEvent({
    event: "order.updated",
    partnerOrderId: String(refunded._id),
    bookingId: refunded.bookingId,
    rental: refunded as unknown as PartnerRentalLike,
    status: refunded.status,
    paymentStatus: "refunded",
    paymentMethod: "paypal",
  });

  console.log("PAYPAL_WEBHOOK_REFUND_RECORDED", {
    bookingId: refunded.bookingId,
  });
  return NextResponse.json({ bookingId: refunded.bookingId });
}
