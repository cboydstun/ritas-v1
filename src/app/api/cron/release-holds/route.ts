import { NextResponse } from "next/server";
import { releaseStaleHolds, STALE_HOLD_MINUTES } from "@/lib/inventory";

/**
 * Releases unpaid rental holds whose units would otherwise stay off the board
 * forever. Scheduled from `vercel.json`; Vercel Cron sends the deployment's
 * CRON_SECRET as a bearer token.
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
