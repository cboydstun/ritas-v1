import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { safeErrorSummary } from "@/lib/safe-error";
import { guardPublicWrite } from "@/lib/api-guard";
import { firstIssueMessage, paypalReleaseHoldSchema } from "@/lib/validation";

/**
 * Give back the machine when a buyer closes the PayPal window.
 *
 * Without this, a buyer who cancels and then books through the invoice path
 * leaves a phantom hold behind, and on the last unit is refused by their own
 * abandoned checkout. The stale-hold reaper is the backstop; this just makes
 * the unit available again in seconds rather than in two hours.
 *
 * Keyed on the PayPal order id, which is unguessable. A rental id would make
 * this a way to cancel a stranger's booking. It refuses anything that is not
 * still an unpaid `pending` hold for the same reason — a submitted or paid
 * booking is not a hold and must never be deleted from here.
 *
 * Always answers 200: the caller fires this best-effort, on a path where the
 * buyer has already walked away, and has nothing useful to do with a failure.
 */
export async function POST(request: Request) {
  try {
    const guard = await guardPublicWrite(request, {
      route: "paypal-release",
      limit: 20,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    const parsed = paypalReleaseHoldSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    await dbConnect();
    const result = await Rental.deleteOne({
      paypalOrderId: parsed.data.orderId,
      status: "pending",
      "payment.status": { $ne: "completed" },
    });

    return NextResponse.json({ released: (result?.deletedCount ?? 0) > 0 });
  } catch (error) {
    console.error("Error releasing PayPal hold:", safeErrorSummary(error));
    return NextResponse.json({ released: false });
  }
}
