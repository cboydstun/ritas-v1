import { NextResponse } from "next/server";
import { getReviewSummary } from "@/lib/reviews";

/**
 * Public proxy for the shared review feed.
 *
 * It exists so the browser never calls the external host directly — the CSP
 * `connect-src` would block it — and so responses are cached for an hour. The
 * site's own pages read `getReviewSummary` on the server instead, so the
 * reviews land in the HTML rather than after hydration.
 *
 * GET /api/v1/reviews
 */
export async function GET() {
  const summary = await getReviewSummary();

  return NextResponse.json(summary.reviews);
}
