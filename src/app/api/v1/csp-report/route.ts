import { NextResponse } from "next/server";
import { clientIdentifier, rateLimit, readJsonBody } from "@/lib/rate-limit";

/**
 * Sink for Content-Security-Policy violation reports.
 *
 * The policy in `next.config.ts` had no `report-uri`/`report-to`, so a
 * violation was invisible in production — which is how the collection outages
 * that policy's own comments describe ran for weeks with nothing failing
 * server-side. Reports land in the runtime logs where they can be alerted on.
 *
 * Browsers post these unauthenticated and without credentials, so this is
 * rate limited like any other public write and never echoes the body back.
 */
export async function POST(request: Request) {
  const { allowed } = await rateLimit(
    `csp-report:${clientIdentifier(request)}`,
    {
      limit: 30,
      windowSeconds: 600,
    },
  );
  // A dropped report is not worth a retry or an error page — the browser
  // ignores the status either way.
  if (!allowed) return new NextResponse(null, { status: 204 });

  const body = await readJsonBody(request, 16 * 1024);
  if (body.ok) {
    // Both shapes: `report-uri` posts { "csp-report": {...} }, `report-to`
    // posts an array of { type, body }.
    console.warn("CSP_VIOLATION", JSON.stringify(body.data).slice(0, 2000));
  }

  return new NextResponse(null, { status: 204 });
}
