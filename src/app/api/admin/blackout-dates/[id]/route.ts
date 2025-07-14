import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { BlackoutDate, createLocalDate } from "@/models/blackout-date";
import mongoose from "mongoose";

// GET /api/admin/blackout-dates/[id] - Get specific blackout date
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Invalid blackout date ID" },
        { status: 400 },
      );
    }

    await dbConnect();

    const blackoutDate = await BlackoutDate.findById(id);

    if (!blackoutDate) {
      return NextResponse.json(
        { message: "Blackout date not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(blackoutDate);
  } catch (error) {
    console.error("Error fetching blackout date:", error);
    return NextResponse.json(
      { message: "Failed to fetch blackout date" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/blackout-dates/[id] - Update blackout date
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Invalid blackout date ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { startDate, endDate, reason, type, startTime, endTime } = body;

    // Validate required fields
    if (!startDate) {
      return NextResponse.json(
        { message: "Start date is required" },
        { status: 400 },
      );
    }

    if (!type || !["full_day", "time_range"].includes(type)) {
      return NextResponse.json(
        { message: "Valid type is required (full_day or time_range)" },
        { status: 400 },
      );
    }

    // Validate time range requirements
    if (type === "time_range") {
      if (!startTime || !endTime) {
        return NextResponse.json(
          {
            message: "Start time and end time are required for time_range type",
          },
          { status: 400 },
        );
      }

      // Validate time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return NextResponse.json(
          { message: "Times must be in HH:MM format" },
          { status: 400 },
        );
      }

      if (startTime >= endTime) {
        return NextResponse.json(
          { message: "End time must be after start time" },
          { status: 400 },
        );
      }
    }

    // Validate date range using createLocalDate to avoid timezone issues
    if (endDate && createLocalDate(startDate) > createLocalDate(endDate)) {
      return NextResponse.json(
        { message: "End date must be after start date" },
        { status: 400 },
      );
    }

    await dbConnect();

    // Check if blackout date exists
    const existingBlackoutDate = await BlackoutDate.findById(id);
    if (!existingBlackoutDate) {
      return NextResponse.json(
        { message: "Blackout date not found" },
        { status: 404 },
      );
    }

    // Update blackout date using createLocalDate to avoid timezone shifts
    const updatedBlackoutDate = await BlackoutDate.findByIdAndUpdate(
      id,
      {
        startDate: createLocalDate(startDate),
        endDate: endDate ? createLocalDate(endDate) : undefined,
        reason: reason || undefined,
        type,
        startTime: type === "time_range" ? startTime : undefined,
        endTime: type === "time_range" ? endTime : undefined,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true },
    );

    return NextResponse.json(updatedBlackoutDate);
  } catch (error) {
    console.error("Error updating blackout date:", error);

    // Handle validation errors
    if (error instanceof Error && error.message.includes("validation failed")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Failed to update blackout date" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/blackout-dates/[id] - Delete blackout date
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Invalid blackout date ID" },
        { status: 400 },
      );
    }

    await dbConnect();

    // Check if blackout date exists
    const existingBlackoutDate = await BlackoutDate.findById(id);
    if (!existingBlackoutDate) {
      return NextResponse.json(
        { message: "Blackout date not found" },
        { status: 404 },
      );
    }

    // Delete blackout date
    await BlackoutDate.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "Blackout date deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting blackout date:", error);
    return NextResponse.json(
      { message: "Failed to delete blackout date" },
      { status: 500 },
    );
  }
}
