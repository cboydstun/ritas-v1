import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/public-settings";

/**
 * Public settings for the order wizard. Server components read
 * `getPublicSettings` directly instead of round-tripping through here.
 */
export async function GET() {
  try {
    return NextResponse.json(await getPublicSettings());
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return NextResponse.json(
      { message: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}
