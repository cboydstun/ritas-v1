import { NextResponse } from "next/server";
import { releaseStaleHolds, STALE_HOLD_MINUTES } from "@/lib/inventory";
import { timingSafeEquals } from "@/lib/timing-safe";
import { sweepOutbox } from "@/lib/partner/send";

/**
 * Higher than the opportunistic per-request sweep: this runs once a day and is
 * the only pass that happens when the site is quiet.
 */
const PARTNER_SWEEP_CRON_LIMIT = 100;

/**
 * Flips expired abandoned `pending` holds to cancelled. Submitted bookings
 * (`pending_payment`) are never reaped.
 *
 * Scheduled daily from `vercel.json` — the Hobby plan does not allow anything
 * more frequent. That cadence is fine because it is *not* what makes
 * availability correct: `isMachineAvailable` already ignores holds older than
 * STALE_HOLD_MINUTES at query time, so a unit frees up the moment its hold
 * expires. This job only keeps the stored `status` honest for the admin views.
 *
 * Vercel Cron sends the deployment's CRON_SECRET as a bearer token
 * automatically, because an env var of that exact name exists.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Without a configured secret the endpoint stays closed rather than open.
  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run");
    return NextResponse.json({ message: "Not configured" }, { status: 503 });
  }

  const presented = request.headers.get("authorization") ?? "";
  if (!timingSafeEquals(presented, `Bearer ${secret}`)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseStaleHolds();

    // The outbox's floor. Every booking request also sweeps a few rows, so
    // under any traffic at all recovery is minutes — but a quiet week with
    // bounce-v3 down would otherwise leave an order off the shared calendar
    // indefinitely. Awaited rather than scheduled: nothing is waiting on this
    // response, and a cron that returns before its work is done is a cron that
    // reports success it has not earned.
    const partnerEventsDelivered = await sweepOutbox(PARTNER_SWEEP_CRON_LIMIT);

    return NextResponse.json({
      released,
      olderThanMinutes: STALE_HOLD_MINUTES,
      partnerEventsDelivered,
    });
  } catch (error) {
    console.error("Error releasing stale holds:", error);
    return NextResponse.json(
      { message: "Failed to release holds" },
      { status: 500 },
    );
  }
}
