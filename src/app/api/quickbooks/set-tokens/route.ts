import { NextRequest, NextResponse } from "next/server";
import { QuickBooksAuth } from "@/lib/quickbooks-auth";

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken, expiresIn, refreshTokenExpiresIn } =
      await request.json();

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { message: "Missing required token data" },
        { status: 400 },
      );
    }

    const qbAuth = QuickBooksAuth.getInstance();

    // Set the tokens manually
    qbAuth.setTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn || 3600,
      x_refresh_token_expires_in: refreshTokenExpiresIn || 8726400,
      token_type: "bearer",
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: "QuickBooks tokens set successfully",
    });
  } catch (error) {
    console.error("Error setting QuickBooks tokens:", error);
    return NextResponse.json(
      {
        message: "Failed to set QuickBooks tokens",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
