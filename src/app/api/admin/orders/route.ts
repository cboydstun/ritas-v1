import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

// Get all orders
export async function GET() {
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
