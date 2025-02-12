import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { withAxiom, AxiomRequest, LogLevel } from "next-axiom";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get a specific order
export const GET = withAxiom(async (request: AxiomRequest, context: RouteParams) => {
  const log = request.log.with({ scope: "admin-order-get" });
  const { id } = await context.params;
  log.debug("Fetching order", { orderId: id });

  try {
    await dbConnect();
    const rental = await Rental.findById(id).select("-__v");

    if (!rental) {
      log.warn("Order not found", { orderId: id });
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    log.info("Order fetched successfully", { 
      orderId: id,
      machineType: rental.machineType,
      status: rental.status
    });
    return NextResponse.json(rental);
  } catch (error) {
    log.error("Error fetching order", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      orderId: id
    });
    return NextResponse.json(
      { message: "Failed to fetch order" },
      { status: 500 },
    );
  }
}, {
  logRequestDetails: ["nextUrl"],
  notFoundLogLevel: LogLevel.error,
  redirectLogLevel: LogLevel.info
});

// Update an order
export const PUT = withAxiom(async (request: AxiomRequest, context: RouteParams) => {
  const log = request.log.with({ scope: "admin-order-update" });
  const { id } = await context.params;
  
  try {
    const data = await request.json();
    log.info("Updating order", { 
      orderId: id,
      updateFields: Object.keys(data)
    });

    await dbConnect();
    const rental = await Rental.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      {
        new: true,
        runValidators: true,
      },
    ).select("-__v");

    if (!rental) {
      log.warn("Order not found for update", { orderId: id });
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    log.info("Order updated successfully", {
      orderId: id,
      machineType: rental.machineType,
      status: rental.status
    });
    return NextResponse.json(rental);
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      log.warn("Validation error updating order", {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        orderId: id
      });
      return NextResponse.json(
        { message: "Invalid update data", details: error.message },
        { status: 400 },
      );
    }

    log.error("Error updating order", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      orderId: id
    });
    return NextResponse.json(
      { message: "Failed to update order" },
      { status: 500 },
    );
  }
}, {
  logRequestDetails: ["body", "nextUrl"],
  notFoundLogLevel: LogLevel.error,
  redirectLogLevel: LogLevel.info
});

// Delete an order
export const DELETE = withAxiom(async (request: AxiomRequest, context: RouteParams) => {
  const log = request.log.with({ scope: "admin-order-delete" });
  const { id } = await context.params;
  log.info("Attempting to delete order", { orderId: id });

  try {
    await dbConnect();
    const rental = await Rental.findByIdAndDelete(id);

    if (!rental) {
      log.warn("Order not found for deletion", { orderId: id });
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    log.info("Order deleted successfully", { 
      orderId: id,
      machineType: rental.machineType,
      status: rental.status
    });
    return NextResponse.json(
      { message: "Order deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    log.error("Error deleting order", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      orderId: id
    });
    return NextResponse.json(
      { message: "Failed to delete order" },
      { status: 500 },
    );
  }
}, {
  logRequestDetails: ["nextUrl"],
  notFoundLogLevel: LogLevel.error,
  redirectLogLevel: LogLevel.info
});
