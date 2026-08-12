import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Contact } from "@/models/contact";
import mongoose from "mongoose";

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

  // An invalid id produced a Mongoose CastError and a 500 instead of a 404.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Contact not found" }, { status: 404 });
  }

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

  // An invalid id produced a Mongoose CastError and a 500 instead of a 404.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Contact not found" }, { status: 404 });
  }

  try {
    const data = await request.json();
    await dbConnect();

    // Triage only changes status; spreading the body allowed writes to `_id`
    // and `createdAt` as well.
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) update.status = data.status;

    const contact = await Contact.findByIdAndUpdate(id, update, {
      new: true, // Return updated document
      runValidators: true, // Run schema validators
    }).select("-__v");

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
      // `error.message` carries model names, field paths and index names; it
      // is logged above rather than handed back to the caller.
      return NextResponse.json(
        {
          message: "Invalid contact data",
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

  // An invalid id produced a Mongoose CastError and a 500 instead of a 404.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Contact not found" }, { status: 404 });
  }

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
