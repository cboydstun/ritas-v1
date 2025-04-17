import OAuthClient from "intuit-oauth";
import { NextResponse } from "next/server";

// Define types for QuickBooks tokens
export interface QuickBooksTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  createdAt?: number;
}

// Define a class to handle QuickBooks authentication
export class QuickBooksAuth {
  private oauthClient: OAuthClient;
  private static instance: QuickBooksAuth;
  private tokens: QuickBooksTokens | null = null;

  private constructor() {
    // Initialize the OAuth client with environment variables
    this.oauthClient = new OAuthClient({
      clientId: process.env.QB_CLIENT_ID || "",
      clientSecret: process.env.QB_CLIENT_SECRET || "",
      environment: process.env.QB_ENVIRONMENT || "sandbox",
      redirectUri: process.env.QB_REDIRECT_URI || "",
    });
  }

  // Singleton pattern to ensure only one instance exists
  public static getInstance(): QuickBooksAuth {
    if (!QuickBooksAuth.instance) {
      QuickBooksAuth.instance = new QuickBooksAuth();
    }
    return QuickBooksAuth.instance;
  }

  // Generate authorization URL for initial connection
  public getAuthorizationUrl(): string {
    return this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: "testState",
    });
  }

  // Handle the callback from QuickBooks OAuth flow
  public async handleCallback(url: string): Promise<QuickBooksTokens> {
    try {
      const authResponse = await this.oauthClient.createToken(url);
      const tokens = authResponse.getJson();

      // Add creation timestamp
      tokens.createdAt = Date.now();

      // Store tokens (in a real app, these should be securely stored in a database)
      this.tokens = tokens;

      return tokens;
    } catch (error) {
      console.error("Error handling QuickBooks callback:", error);
      throw error;
    }
  }

  // Check if tokens are valid and refresh if needed
  public async getValidTokens(): Promise<QuickBooksTokens> {
    if (!this.tokens) {
      throw new Error(
        "No QuickBooks tokens available. Please authenticate first.",
      );
    }

    // Check if refresh token is expired (with 1-day buffer)
    const createdAt = this.tokens.createdAt || Date.now();
    const refreshTokenExpiresAt =
      createdAt +
      this.tokens.x_refresh_token_expires_in * 1000 -
      24 * 60 * 60 * 1000;

    if (Date.now() > refreshTokenExpiresAt) {
      // Refresh token is expired, need to re-authenticate
      console.warn(
        "QuickBooks refresh token has expired. Re-authentication required.",
      );
      this.tokens = null;
      throw new Error(
        "QuickBooks refresh token has expired. Please re-authenticate.",
      );
    }

    // Check if access token is expired (with 5-minute buffer)
    const accessTokenExpiresAt =
      createdAt + this.tokens.expires_in * 1000 - 5 * 60 * 1000;
    if (Date.now() > accessTokenExpiresAt) {
      // Token is expired, refresh it
      try {
        console.log("Refreshing QuickBooks access token...");
        const refreshResponse = await this.oauthClient.refresh();
        const newTokens = refreshResponse.getJson();

        // Update stored tokens
        this.tokens = {
          ...newTokens,
          createdAt: Date.now(),
        };
        console.log("QuickBooks access token refreshed successfully.");
      } catch (error) {
        console.error("Error refreshing QuickBooks tokens:", error);

        // Check if the error is due to an invalid refresh token
        const errorStr = String(error);
        if (
          errorStr.includes("invalid_grant") ||
          errorStr.includes("Token expired") ||
          errorStr.includes("invalid_token")
        ) {
          console.warn(
            "QuickBooks refresh token is invalid. Re-authentication required.",
          );
          this.tokens = null;
          throw new Error(
            "QuickBooks authentication has expired. Please re-authenticate.",
          );
        }

        throw error;
      }
    }

    return this.tokens;
  }

  // Revoke tokens when disconnecting
  public async disconnect(): Promise<boolean> {
    if (!this.tokens) {
      return true; // Already disconnected
    }

    try {
      // Try to revoke the token, but don't let failures stop the disconnect process
      try {
        await this.oauthClient.revoke({
          token: this.tokens.access_token,
        });
      } catch (revokeError) {
        // Log the error but continue with disconnection
        console.warn("Error revoking QuickBooks token:", revokeError);
        // Token might be expired or invalid, which is fine since we're disconnecting anyway
      }

      // Always clear the tokens, even if revocation failed
      this.tokens = null;
      return true;
    } catch (error) {
      console.error("Error disconnecting from QuickBooks:", error);

      // As a last resort, still try to clear tokens
      this.tokens = null;

      // Return true instead of throwing, since we've cleared the tokens locally
      return true;
    }
  }

  // Set tokens manually (useful for loading from database)
  public setTokens(tokens: QuickBooksTokens): void {
    this.tokens = tokens;
  }
}

// API route handlers for QuickBooks authentication

// Generate authorization URL
export async function getAuthorizationUrlHandler() {
  try {
    const qbAuth = QuickBooksAuth.getInstance();
    const authUrl = qbAuth.getAuthorizationUrl();

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Error generating QuickBooks authorization URL:", error);
    return NextResponse.json(
      { message: "Failed to generate authorization URL" },
      { status: 500 },
    );
  }
}

// Handle OAuth callback
export async function handleCallbackHandler(request: Request) {
  try {
    const url = request.url;
    const qbAuth = QuickBooksAuth.getInstance();
    const tokens = await qbAuth.handleCallback(url);

    // In a real application, you would store these tokens securely in a database
    // For now, we're storing them in memory in the QuickBooksAuth instance
    console.log("QuickBooks tokens obtained successfully:", {
      access_token: tokens.access_token.substring(0, 10) + "...",
      refresh_token: tokens.refresh_token.substring(0, 10) + "...",
      expires_in: tokens.expires_in,
      x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
      createdAt: tokens.createdAt,
    });

    return NextResponse.json({
      success: true,
      message: "Successfully connected to QuickBooks",
    });
  } catch (error) {
    console.error("Error handling QuickBooks callback:", error);
    return NextResponse.json(
      { message: "Failed to complete QuickBooks authentication" },
      { status: 500 },
    );
  }
}

// Disconnect from QuickBooks
export async function disconnectHandler() {
  try {
    const qbAuth = QuickBooksAuth.getInstance();
    await qbAuth.disconnect();

    return NextResponse.json({
      success: true,
      message: "Successfully disconnected from QuickBooks",
    });
  } catch (error) {
    console.error("Error disconnecting from QuickBooks:", error);
    return NextResponse.json(
      { message: "Failed to disconnect from QuickBooks" },
      { status: 500 },
    );
  }
}
