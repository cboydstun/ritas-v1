import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Contact } from "@/models/contact";
import { adminListLimit, adminListHeaders } from "@/lib/admin-list";

// Get all contacts
export async function GET(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const limit = adminListLimit(
      new URL(request.url).searchParams.get("limit"),
    );
    const [contacts, total] = await Promise.all([
      Contact.find({})
        .sort({ createdAt: -1 }) // Sort by newest first
        .limit(limit)
        .select("-__v") // Exclude version key
        .lean(),
      Contact.countDocuments({}),
    ]);

    return NextResponse.json(contacts, {
      headers: adminListHeaders(total, contacts.length),
    });
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

    // Explicit field list, mirroring `/api/v1/contacts`. `Contact.create(data)`
    // took the raw body, so a caller could set `_id`, `createdAt` and `status`
    // directly.
    const contact = await Contact.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      eventDate: data.eventDate,
      message: data.message,
      ...(data.status !== undefined ? { status: data.status } : {}),
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);

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
      { message: "Failed to create contact" },
      { status: 500 },
    );
  }
}
