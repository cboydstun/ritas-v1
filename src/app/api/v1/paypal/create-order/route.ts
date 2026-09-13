import { NextResponse } from "next/server";
import { Rental } from "@/models/rental";
import { safeErrorSummary } from "@/lib/safe-error";
import { guardPublicWrite } from "@/lib/api-guard";
import { createBooking } from "@/lib/booking/createBooking";
import { createPayPalOrder, paypalConfigured } from "@/lib/paypal/client";
import { firstIssueMessage, paypalCreateOrderSchema } from "@/lib/validation";

/**
 * Open a PayPal order for a cart, holding the machine while the buyer pays.
 *
 * The booking is written **first**, as `status: "pending"`, so the unit is
 * held for the length of the payment window and released by the existing
 * stale-hold reaper if the buyer walks away. Nothing is told to the customer
 * here — the confirmation email is sent by the capture route, once, and only
 * once money has actually moved.
 */
export async function POST(request: Request) {
  try {
    const guard = await guardPublicWrite(request, {
      route: "paypal-create",
      limit: 5,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    // `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is inlined at build time, so it can
    // outlive or precede the server credentials — buttons render, this route
    // has nothing to call. The message is customer-readable on purpose: that
    // divergence must degrade into the invoice path, not a dead end.
    if (!paypalConfigured()) {
      return NextResponse.json(
        {
          message:
            "Online payment is temporarily unavailable. You can still book now and we will invoice you.",
        },
        { status: 503 },
      );
    }

    const parsed = paypalCreateOrderSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { rentalData, reuseBookingId } = parsed.data;

    const result = await createBooking(rentalData, {
      status: "pending",
      reuseBookingId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }

    let order;
    try {
      order = await createPayPalOrder({
        amountUsd: result.rental.price as number,
        bookingId: result.bookingId,
        // Distinguishes a deliberate second attempt from a retried request:
        // the buyer re-entering the flow must get a new order, a duplicated
        // HTTP request must not.
        requestId: `${result.bookingId}:${Date.now()}`,
      });
    } catch (paypalError) {
      // A hold PayPal never learned about is unreachable by capture and
      // invisible to the operator, so it would just sit on a unit until the
      // reaper caught it. Only roll back a document this call inserted — a
      // reused hold predates us and is not ours to delete.
      if (result.inserted) {
        try {
          await Rental.deleteOne({ _id: result.savedRental._id });
        } catch (rollbackError) {
          console.error("PAYPAL_CREATE_ROLLBACK_FAILED", {
            bookingId: result.bookingId,
            reason: safeErrorSummary(rollbackError),
          });
        }
      }
      throw paypalError;
    }

    // `doc.save()` rather than an update: the `pre("save")` hook leaves
    // `createdAt` alone once the document is no longer new, and the oversell
    // tie-break reads `createdAt` to decide which of two racers was first.
    result.rental.paypalOrderId = order.id;
    await (result.rental as unknown as { save(): Promise<unknown> }).save();

    return NextResponse.json({ id: order.id, bookingId: result.bookingId });
  } catch (error) {
    console.error("Error creating PayPal order:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "We could not start the payment. Please try again." },
      { status: 502 },
    );
  }
}
