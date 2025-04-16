import { NextResponse } from "next/server";
import { QuickBooksAuth } from "@/lib/quickbooks-auth";

export async function GET() {
  try {
    const qbAuth = QuickBooksAuth.getInstance();
    let connected = false;
    let tokenDetails = null;

    try {
      // Try to get valid tokens - if this succeeds, we're connected
      const tokens = await qbAuth.getValidTokens();
      connected = true;
      
      // Calculate expiration times for display
      const createdAt = tokens.createdAt || Date.now();
      const accessTokenExpiresAt = new Date(createdAt + (tokens.expires_in * 1000));
      const refreshTokenExpiresAt = new Date(createdAt + (tokens.x_refresh_token_expires_in * 1000));
      
      // Format token details for response
      tokenDetails = {
        accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
        refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
        accessTokenExpiresIn: Math.floor((accessTokenExpiresAt.getTime() - Date.now()) / 1000),
        refreshTokenExpiresIn: Math.floor((refreshTokenExpiresAt.getTime() - Date.now()) / 1000),
      };
      
      console.log("QuickBooks connection status: Connected", tokenDetails);
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
      tokenDetails: connected ? tokenDetails : null,
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
