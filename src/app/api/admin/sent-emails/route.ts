import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSentEmails } from "@/lib/email-service";

// GET /api/admin/sent-emails - List sent emails with pagination
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const statusParam = searchParams.get("status");
    
    // Only pass status if it's a valid value
    const status = statusParam === "sent" || 
                  statusParam === "failed" || 
                  statusParam === "delivered" || 
                  statusParam === "bounced" 
                  ? statusParam as "sent" | "failed" | "delivered" | "bounced"
                  : undefined;

    // Get sent emails with pagination
    const result = await getSentEmails({
      page,
      limit,
      status,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching sent emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch sent emails" },
      { status: 500 }
    );
  }
}
