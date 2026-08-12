import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import {
  BlackoutDate,
  createLocalDate,
  MODEL_RULE_MESSAGES,
} from "@/models/blackout-date";
import mongoose from "mongoose";
import { guardAdminWrite } from "@/lib/api-guard";
import { blackoutDateSchema, firstIssueMessage } from "@/lib/validation";

// Type for MongoDB query structure
interface BlackoutDateQuery {
  startDate?: { $gte?: Date; $lte?: Date };
  $or?: Array<{
    startDate?: { $gte?: Date; $lte?: Date };
    endDate?: { $gte?: Date; $lte?: Date; $exists?: boolean };
  }>;
}

/** Bounded page size, so `?limit=abc` cannot put NaN into `.limit()`. */
function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
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
    const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
    const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100_000);

    await dbConnect();

    // Build query
    const query: BlackoutDateQuery = {};

    // Range overlap, not a union of loose bounds. The previous four-clause
    // $or matched every document for any start <= end, so the filter silently
    // did nothing: a doc with startDate < start still satisfied startDate <= end.
    if (startDate || endDate) {
      const from = startDate ? new Date(startDate) : undefined;
      const to = endDate ? new Date(endDate) : undefined;

      if (to) {
        query.startDate = { $lte: to };
      }

      if (from) {
        // A single-day blackout has no endDate, so it overlaps only when its
        // startDate itself falls in range.
        query.$or = [
          { endDate: { $gte: from } },
          { endDate: { $exists: false }, startDate: { $gte: from } },
        ];
      }
    }

    // The sibling list routes (orders, contacts, lease-inquiries) already
    // run these two in parallel and read lean; this one awaited them in
    // sequence and hydrated full Mongoose documents only to serialise them.
    const [blackoutDates, total] = await Promise.all([
      BlackoutDate.find(query)
        .sort({ startDate: 1 })
        .limit(limit)
        .skip(offset)
        .lean(),
      BlackoutDate.countDocuments(query),
    ]);

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

    // Admin handlers read the body directly, so MAX_BODY_BYTES never
    // applied to them. Post-auth this bounds a compromised session.
    const guard = await guardAdminWrite(request);
    if (!guard.ok) return guard.response;

    // This handler validated by hand, duplicating ~50 lines with the [id]
    // route that were free to drift apart, and left `reason` unbounded.
    const parsed = blackoutDateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { startDate, endDate, reason, type, startTime, endTime } =
      parsed.data;

    // createLocalDate keeps the stored instant on the same calendar day the
    // admin picked; the schema has already proved both are real dates.
    const parsedStart = createLocalDate(startDate);
    const parsedEnd = endDate ? createLocalDate(endDate) : undefined;

    // Validate date range using createLocalDate to avoid timezone issues
    if (parsedEnd && parsedStart > parsedEnd) {
      return NextResponse.json(
        { message: "End date must be on or after start date" },
        { status: 400 },
      );
    }

    await dbConnect();

    // Create new blackout date using createLocalDate to avoid timezone shifts
    const blackoutDate = new BlackoutDate({
      startDate: parsedStart,
      endDate: parsedEnd,
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

    // Handle validation errors.
    //
    // The `pre("save")` hooks in the model throw plain Errors ("End date must
    // be after start date"), whose messages contain no "validation failed"
    // substring — so the old check never matched and every legitimate 400 was
    // reported to the admin as a 500.
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { message: Object.values(error.errors)[0]?.message ?? error.message },
        { status: 400 },
      );
    }
    if (error instanceof Error && MODEL_RULE_MESSAGES.has(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Failed to create blackout date" },
      { status: 500 },
    );
  }
}
