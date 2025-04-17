import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSentEmail } from "@/lib/email-service";

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/admin/sent-emails/[id] - Get details of a specific sent email
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sent email by ID
    const email = await getSentEmail(params.id);

    return NextResponse.json(email);
  } catch (error) {
    console.error(`Error fetching sent email ${params.id}:`, error);

    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: `Sent email with ID ${params.id} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch sent email" },
      { status: 500 },
    );
  }
}
