import { NextResponse } from "next/server";
import { QuickBooksAuth } from "@/lib/quickbooks-auth";

export async function GET() {
  try {
    const qbAuth = QuickBooksAuth.getInstance();
    let connected = false;

    try {
      // Try to get valid tokens - if this succeeds, we're connected
      await qbAuth.getValidTokens();
      connected = true;
    } catch (error) {
      // If there's an error, we're not connected
      connected = false;
      console.error("Error getting valid tokens:", error);
    }

    return NextResponse.json({
      connected,
      message: connected
        ? "Connected to QuickBooks"
        : "Not connected to QuickBooks",
    });
  } catch (error) {
    console.error("Error checking QuickBooks connection status:", error);
    return NextResponse.json(
      {
        connected: false,
        message: "Error checking connection status",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
