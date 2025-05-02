import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Contact } from "@/models/contact";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get a specific contact
export async function GET(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await dbConnect();
    const contact = await Contact.findById(id).select("-__v");

    if (!contact) {
      return NextResponse.json(
        { message: "Contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { message: "Failed to fetch contact" },
      { status: 500 },
    );
  }
}

// Update a contact
export async function PUT(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data = await request.json();
    await dbConnect();

    const contact = await Contact.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      },
    ).select("-__v");

    if (!contact) {
      return NextResponse.json(
        { message: "Contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);

    // Check for validation errors
    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        {
          message: "Invalid contact data",
          details: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to update contact" },
      { status: 500 },
    );
  }
}

// Delete a contact
export async function DELETE(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await dbConnect();
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return NextResponse.json(
        { message: "Contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: "Contact deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { message: "Failed to delete contact" },
      { status: 500 },
    );
  }
}
