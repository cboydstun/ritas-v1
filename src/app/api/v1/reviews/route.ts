import { NextResponse } from "next/server";

/**
 * API route for proxying reviews from external service
 * GET /api/v1/reviews
 */
export async function GET() {
  try {
    // Make server-side request to the external API
    const response = await fetch("https://satxbounce.com/api/v1/reviews", {
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reviews: ${response.status}`);
    }

    // Get the data from the response
    const data = await response.json();

    // Return the data to the client
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
