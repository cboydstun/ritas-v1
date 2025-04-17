import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/lib/email-service";

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/admin/email-templates/[id] - Get a specific email template
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get email template by ID
    const template = await getEmailTemplate(params.id);

    return NextResponse.json(template);
  } catch (error) {
    console.error(`Error fetching email template ${params.id}:`, error);

    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: `Email template with ID ${params.id} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch email template" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/email-templates/[id] - Update a specific email template
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Update email template
    const template = await updateEmailTemplate(params.id, {
      name: data.name,
      description: data.description,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
      isDefault: data.isDefault,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error(`Error updating email template ${params.id}:`, error);

    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: `Email template with ID ${params.id} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update email template" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/email-templates/[id] - Delete a specific email template
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete email template
    await deleteEmailTemplate(params.id);

    return NextResponse.json(
      { message: `Email template ${params.id} deleted successfully` },
      { status: 200 },
    );
  } catch (error) {
    console.error(`Error deleting email template ${params.id}:`, error);

    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: `Email template with ID ${params.id} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete email template" },
      { status: 500 },
    );
  }
}
