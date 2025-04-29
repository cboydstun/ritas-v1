import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Contact } from "@/models/contact";

// Get all contacts
export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const contacts = await Contact.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .select("-__v"); // Exclude version key

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { message: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}

// Create a new contact (if needed in admin panel)
export async function POST(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    await dbConnect();

    const contact = await Contact.create(data);

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);

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
      { message: "Failed to create contact" },
      { status: 500 },
    );
  }
}
