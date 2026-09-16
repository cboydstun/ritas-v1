import { NextResponse } from "next/server";
import { safeErrorSummary } from "@/lib/safe-error";
import { guardPublicWrite } from "@/lib/api-guard";
import { capturePayPalBooking } from "@/lib/booking/capturePayPalBooking";
import { paypalConfigured, payPalErrorDetail } from "@/lib/paypal/client";
import { firstIssueMessage, paypalCaptureSchema } from "@/lib/validation";

/**
 * Take the money for an approved PayPal order and confirm the booking.
 *
 * The body carries **only** the order id — the amount is read back from PayPal
 * and checked against the stored price, inside `capturePayPalBooking`, which
 * is also what the webhook calls when the buyer's browser never came back.
 * This route is the HTTP shell: limits, parsing, and the mapping from that
 * module's refusals to status codes and customer-readable copy.
 */
export async function POST(request: Request) {
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

    const result = await capturePayPalBooking(parsed.data.orderId);
    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }

    // `settled` and `amount` are what let the browser tell the customer the
    // truth rather than reading every 200 as "paid in full".
    return NextResponse.json({
      bookingId: result.bookingId,
      settled: result.settled,
      amount: result.amount,
    });
  } catch (error) {
    // `PAYPAL_CAPTURE_ORPHANED` — the money moved and the write then failed —
    // is logged by `settleCapturedBooking`, which is the only scope that knows
    // a capture happened. This is every other failure.
    //
    // Deliberately no `isPayPalAuthFailure` degradation to the invoice copy
    // here, unlike `create-order`: a payment the buyer has already approved is
    // not something to shrug off with "book now and we will invoice you".
    const detail = payPalErrorDetail(error);
    console.error("Error capturing PayPal order:", {
      issue: detail?.issue,
      debugId: detail?.debugId,
      status: detail?.status,
      reason: safeErrorSummary(error),
    });

    return NextResponse.json(
      {
        message:
          "We could not confirm your payment. Please call us before trying again.",
      },
      { status: 502 },
    );
  }
}
