import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/public-settings";

/**
 * Public settings for the order wizard. Server components read
 * `getPublicSettings` directly instead of round-tripping through here.
 *
 * Revalidated rather than recomputed per request: this used to be a Mongo
 * round-trip for every anonymous visitor who opened /order. Settings are
 * admin-edited rarely, and 60s matches the window `/long-term-lease` already
 * uses, so an edit is still visible without a deploy.
 */
export const revalidate = 60;

export async function GET() {
  try {
    return NextResponse.json(await getPublicSettings(), {
      headers: {
        // Lets the CDN serve the shared copy and keeps a stale one usable
        // while the next fetch happens, so a slow Mongo read never blocks the
        // order form's settings fetch.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return NextResponse.json(
      { message: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}
