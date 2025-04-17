import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmailWithTemplate } from "@/lib/email-service";

// POST /api/admin/email-templates/send-test - Send a test email using a template
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const data = await request.json();

    // Validate required fields
    if (!data.templateId || !data.to) {
      return NextResponse.json(
        { error: "Template ID and recipient email are required" },
        { status: 400 },
      );
    }

    // Ensure 'to' is an array
    const to = Array.isArray(data.to) ? data.to : [data.to];

    // Send test email
    const result = await sendEmailWithTemplate({
      templateId: data.templateId,
      to,
      cc: data.cc,
      bcc: data.bcc,
      variables: data.variables || {},
      from: data.from,
    });

    return NextResponse.json({
      message: "Test email sent successfully",
      id: result.id,
    });
  } catch (error) {
    console.error("Error sending test email:", error);

    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
