import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LeaseInquiry } from "@/models/leaseInquiry";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await dbConnect();
    const inquiry = await LeaseInquiry.findById(id).select("-__v");

    if (!inquiry) {
      return NextResponse.json(
        { message: "Lease inquiry not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(inquiry);
  } catch (error) {
    console.error("Error fetching lease inquiry:", error);
    return NextResponse.json(
      { message: "Failed to fetch lease inquiry" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data = await request.json();
    await dbConnect();

    const inquiry = await LeaseInquiry.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      {
        new: true,
        runValidators: true,
      },
    ).select("-__v");

    if (!inquiry) {
      return NextResponse.json(
        { message: "Lease inquiry not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(inquiry);
  } catch (error) {
    console.error("Error updating lease inquiry:", error);

    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        {
          message: "Invalid lease inquiry data",
          details: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to update lease inquiry" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await dbConnect();
    const inquiry = await LeaseInquiry.findByIdAndDelete(id);

    if (!inquiry) {
      return NextResponse.json(
        { message: "Lease inquiry not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: "Lease inquiry deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting lease inquiry:", error);
    return NextResponse.json(
      { message: "Failed to delete lease inquiry" },
      { status: 500 },
    );
  }
}
