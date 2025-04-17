import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllEmailTemplates, createEmailTemplate } from "@/lib/email-service";

// GET /api/admin/email-templates - List all email templates
export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all email templates
    const templates = await getAllEmailTemplates();

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 },
    );
  }
}

// POST /api/admin/email-templates - Create a new email template
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
    if (!data.name || !data.subject || !data.body) {
      return NextResponse.json(
        { error: "Name, subject, and body are required" },
        { status: 400 },
      );
    }

    // Create email template
    const template = await createEmailTemplate({
      name: data.name,
      description: data.description,
      subject: data.subject,
      body: data.body,
      variables: data.variables || [],
      isDefault: data.isDefault || false,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating email template:", error);
    return NextResponse.json(
      { error: "Failed to create email template" },
      { status: 500 },
    );
  }
}
