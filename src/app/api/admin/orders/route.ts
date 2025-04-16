import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

// Get all orders
export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    await dbConnect();
    const rentals = await Rental.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .select("-__v"); // Exclude version key

    return NextResponse.json(rentals);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { message: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}

// Create a new order (if needed in admin panel)
export async function POST(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await request.json();
    await dbConnect();

    const rental = new Rental(data);
    const savedRental = await rental.save();

    return NextResponse.json(savedRental, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);

    // Enhanced error logging for schema validation issues
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      // Check for validation errors (e.g., missing required fields or invalid mixer selections)
      if (error.name === "ValidationError") {
        return NextResponse.json(
          {
            message: "Invalid rental data",
            details: error.message,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 },
    );
  }
}
