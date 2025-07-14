import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { BlackoutDate, isDateBlackedOut } from "@/models/blackout-date";
import { MachineType } from "@/types";

export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const machineType = url.searchParams.get("machineType") as MachineType;
    const capacityParam = url.searchParams.get("capacity");
    const date = url.searchParams.get("date");

    // Validate parameters
    if (!machineType || !capacityParam || !date) {
      return NextResponse.json(
        {
          message:
            "Missing required parameters: machineType, capacity, and date are required",
        },
        { status: 400 },
      );
    }

    // Validate machine type
    if (!["single", "double", "triple"].includes(machineType)) {
      return NextResponse.json(
        {
          message:
            "Invalid machineType. Must be 'single', 'double', or 'triple'",
        },
        { status: 400 },
      );
    }

    // Validate capacity
    const capacity = parseInt(capacityParam, 10);
    if (![15, 30, 45].includes(capacity)) {
      return NextResponse.json(
        { message: "Invalid capacity. Must be 15, 30, or 45" },
        { status: 400 },
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { message: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    // Connect to database
    await dbConnect();

    // Check for blackout dates first
    const blackoutDates = await BlackoutDate.find({
      $or: [
        {
          startDate: { $lte: new Date(date) },
          endDate: { $gte: new Date(date) },
        },
        {
          startDate: { $lte: new Date(date) },
          endDate: { $exists: false },
        },
      ],
    });

    // Check if the date is blacked out
    const isBlackedOut = isDateBlackedOut(new Date(date), blackoutDates);

    if (isBlackedOut) {
      return NextResponse.json({
        available: false,
        machineType,
        capacity,
        date,
        reason: "Date is not available due to blackout period",
      });
    }

    // Check for conflicting rentals
    const conflictingRentals = await Rental.find({
      machineType,
      capacity,
      status: { $in: ["pending", "confirmed", "in-progress"] },
      rentalDate: { $lte: date },
      returnDate: { $gte: date },
    }).limit(1); // We only need to know if at least one exists

    // Determine availability
    const available = conflictingRentals.length === 0;

    // Return response
    return NextResponse.json({
      available,
      machineType,
      capacity,
      date,
    });
  } catch (error) {
    console.error("Error checking machine availability:", error);
    return NextResponse.json(
      { message: "Failed to check machine availability" },
      { status: 500 },
    );
  }
}
