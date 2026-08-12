import { NextResponse } from "next/server";
import { getReviewSummary } from "@/lib/reviews";

/**
 * Public proxy for the shared review feed.
 *
 * Nothing in this app calls it. `SocialProofSection` is a server component
 * reading `getReviewSummary` directly, so the reviews land in the HTML Google
 * indexes rather than after hydration — which removed the client fetch this
 * route was originally added to serve.
 *
 * It is kept deliberately, as a stable public passthrough: the CSP
 * `connect-src` does not allow satxbounce.com, so any browser-side consumer
 * (here or elsewhere) must come through this origin. Deleting it is safe only
 * once you know no external caller depends on it.
 *
 * GET /api/v1/reviews
 */
export async function GET() {
  const summary = await getReviewSummary();

  return NextResponse.json(summary.reviews);
}
