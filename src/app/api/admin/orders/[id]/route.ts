import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get a specific order
export async function GET(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await dbConnect();
    const rental = await Rental.findById(id).select("-__v");

    if (!rental) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(rental);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { message: "Failed to fetch order" },
      { status: 500 },
    );
  }
}

// Update an order
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

    const rental = await Rental.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      },
    ).select("-__v");

    if (!rental) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(rental);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { message: "Failed to update order" },
      { status: 500 },
    );
  }
}

// Delete an order
export async function DELETE(request: Request, context: RouteParams) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await dbConnect();
    const rental = await Rental.findByIdAndDelete(id);

    if (!rental) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Order deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { message: "Failed to delete order" },
      { status: 500 },
    );
  }
}
