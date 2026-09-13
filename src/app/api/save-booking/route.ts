import { NextResponse } from "next/server";
import { safeErrorSummary } from "@/lib/safe-error";
import { guardPublicWrite } from "@/lib/api-guard";
import { createBooking } from "@/lib/booking/createBooking";
import { sendBookingNotifications } from "@/lib/booking/notify";

/**
 * The public customer checkout. Takes the booking and collects no money —
 * the customer is invoiced out of band afterwards.
 *
 * The pipeline itself lives in `@/lib/booking/createBooking`, shared with the
 * PayPal create-order route so the two cannot drift on capacity derivation,
 * catalog pricing, the service-area gate or the oversell recheck.
 */
export async function POST(request: Request) {
  try {
    // Every booking persists a rental and fans out to Twilio and Resend, so
    // an unthrottled caller costs money and holds inventory hostage.
    const guard = await guardPublicWrite(request, {
      route: "save-booking",
      limit: 5,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    const body = guard.data as { rentalData?: unknown } | null;

    // `pending_payment`, not `pending`: this booking is submitted and the
    // customer holds a confirmation email for it. Only `pending` is ever
    // reaped — see `releaseStaleHolds` in `src/lib/inventory.ts`.
    const result = await createBooking(body?.rentalData, {
      status: "pending_payment",
    });

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }

    await sendBookingNotifications({
      rental: result.rental,
      bookingId: result.bookingId,
      totals: result.totals,
      rates: result.rates,
      mixerLabel: result.mixerLabel,
      resolvedMixers: result.resolvedMixers,
      payment: { paid: false },
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      rentalId: result.rentalId,
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    // Only the error's shape is logged. Mongoose validation and duplicate-key
    // messages embed the offending values — name, email, phone, address — and
    // production builds keep console.error, so logging them wholesale shipped
    // customer PII into the runtime logs.
    console.error("Error saving booking:", safeErrorSummary(error));

    // Detail stays in the logs — Mongoose validation and MongoServerError
    // messages expose collection names, field paths and index names.
    return NextResponse.json(
      { message: "Failed to save booking" },
      { status: 500 },
    );
  }
}
