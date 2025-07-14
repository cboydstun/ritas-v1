import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { BlackoutDate, createLocalDate } from "@/models/blackout-date";

// Type for MongoDB query structure
interface BlackoutDateQuery {
  $or?: Array<{
    startDate?: { $gte?: Date; $lte?: Date };
    endDate?: { $gte?: Date; $lte?: Date };
  }>;
}

// GET /api/admin/blackout-dates - List all blackout dates
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters for filtering
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    await dbConnect();

    // Build query
    const query: BlackoutDateQuery = {};

    if (startDate || endDate) {
      query.$or = [];

      if (startDate) {
        query.$or.push({ startDate: { $gte: new Date(startDate) } });
        query.$or.push({ endDate: { $gte: new Date(startDate) } });
      }

      if (endDate) {
        query.$or.push({ startDate: { $lte: new Date(endDate) } });
        query.$or.push({ endDate: { $lte: new Date(endDate) } });
      }
    }

    // Get blackout dates with pagination
    const blackoutDates = await BlackoutDate.find(query)
      .sort({ startDate: 1 })
      .limit(limit)
      .skip(offset);

    // Get total count for pagination
    const total = await BlackoutDate.countDocuments(query);

    return NextResponse.json({
      blackoutDates,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching blackout dates:", error);
    return NextResponse.json(
      { message: "Failed to fetch blackout dates" },
      { status: 500 },
    );
  }
}

// POST /api/admin/blackout-dates - Create new blackout date
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

    // Create new blackout date using createLocalDate to avoid timezone shifts
    const blackoutDate = new BlackoutDate({
      startDate: createLocalDate(startDate),
      endDate: endDate ? createLocalDate(endDate) : undefined,
      reason: reason || undefined,
      type,
      startTime: type === "time_range" ? startTime : undefined,
      endTime: type === "time_range" ? endTime : undefined,
      createdBy: session.user?.name || "admin",
    });

    const savedBlackoutDate = await blackoutDate.save();

    return NextResponse.json(savedBlackoutDate, { status: 201 });
  } catch (error) {
    console.error("Error creating blackout date:", error);

    // Handle validation errors
    if (error instanceof Error && error.message.includes("validation failed")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Failed to create blackout date" },
      { status: 500 },
    );
  }
}
