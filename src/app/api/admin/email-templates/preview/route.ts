import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { previewEmailTemplate } from "@/lib/email-service";

// POST /api/admin/email-templates/preview - Preview an email template with variables
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const data = await request.json();

    // Validate required fields
    if (!data.templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Preview email template with variables
    const preview = await previewEmailTemplate({
      templateId: data.templateId,
      variables: data.variables || {},
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error previewing email template:", error);
    
    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to preview email template" },
      { status: 500 }
    );
  }
}
