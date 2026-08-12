import { NextResponse } from "next/server";
import { releaseStaleHolds, STALE_HOLD_MINUTES } from "@/lib/inventory";

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

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseStaleHolds();
    return NextResponse.json({
      released,
      olderThanMinutes: STALE_HOLD_MINUTES,
    });
  } catch (error) {
    console.error("Error releasing stale holds:", error);
    return NextResponse.json(
      { message: "Failed to release holds" },
      { status: 500 },
    );
  }
}
