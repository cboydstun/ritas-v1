import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { withAxiom, AxiomRequest, LogLevel } from "next-axiom";

// Get all orders
export const GET = withAxiom(async (request: AxiomRequest) => {
  const log = request.log.with({ scope: "admin-orders-get" });
  
  try {
    await dbConnect();
    log.debug("Database connection established");
    
    const rentals = await Rental.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .select("-__v"); // Exclude version key

    log.info("Orders fetched successfully", { count: rentals.length });
    return NextResponse.json(rentals);
  } catch (error) {
    log.error("Error fetching orders", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error
    });
    
    return NextResponse.json(
      { message: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}, {
  logRequestDetails: ["nextUrl"],
  notFoundLogLevel: LogLevel.error,
  redirectLogLevel: LogLevel.info
});

// Create a new order (if needed in admin panel)
export const POST = withAxiom(async (request: AxiomRequest) => {
  const log = request.log.with({ scope: "admin-orders-post" });
  
  try {
    const data = await request.json();
    log.info("Received new order request", { 
      machineType: data.machineType,
      customerName: data.customer?.name 
    });

    await dbConnect();
    log.debug("Database connection established");

    const rental = new Rental(data);
    const savedRental = await rental.save();
    
    log.info("Order created successfully", { 
      rentalId: savedRental._id,
      machineType: savedRental.machineType
    });

    return NextResponse.json(savedRental, { status: 201 });
  } catch (error) {
    // Enhanced error logging
    if (error instanceof Error) {
      const errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };

      // Check for validation errors
      if (error.name === "ValidationError") {
        log.warn("Validation error creating order", {
          error: errorDetails,
          details: error.message
        });
        
        return NextResponse.json(
          {
            message: "Invalid rental data",
            details: error.message,
          },
          { status: 400 },
        );
      }

      // Log other errors
      log.error("Error creating order", {
        error: errorDetails
      });
    } else {
      log.error("Unknown error creating order", { error });
    }

    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 },
    );
  }
}, {
  logRequestDetails: ["body", "nextUrl"],
  notFoundLogLevel: LogLevel.error,
  redirectLogLevel: LogLevel.info
});
