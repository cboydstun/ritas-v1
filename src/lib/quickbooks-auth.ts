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

    // Check if access token is expired (with 5-minute buffer)
    const createdAt = this.tokens.createdAt || Date.now();
    const expiresAt = createdAt + this.tokens.expires_in * 1000 - 5 * 60 * 1000;
    if (Date.now() > expiresAt) {
      // Token is expired, refresh it
      try {
        const refreshResponse = await this.oauthClient.refresh();
        const newTokens = refreshResponse.getJson();

        // Update stored tokens
        this.tokens = {
          ...newTokens,
          createdAt: Date.now(),
        };
      } catch (error) {
        console.error("Error refreshing QuickBooks tokens:", error);
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
      await this.oauthClient.revoke({
        token: this.tokens.access_token,
      });
      this.tokens = null;
      return true;
    } catch (error) {
      console.error("Error disconnecting from QuickBooks:", error);
      throw error;
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
export async function handleCallbackHandler() {
  try {
    // const url = request.url;
    // const qbAuth = QuickBooksAuth.getInstance();
    // const tokens = await qbAuth.handleCallback(url);

    // In a real application, you would store these tokens securely in a database
    // For now, we'll just return them (not recommended for production)

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
