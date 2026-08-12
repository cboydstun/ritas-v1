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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/blackout-dates/[id] - Get specific blackout date
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

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
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: "Invalid blackout date ID" },
        { status: 400 },
      );
    }

    // Admin handlers read the body directly, so MAX_BODY_BYTES never
    // applied to them. Post-auth this bounds a compromised session.
    const guard = await guardAdminWrite(request);
    if (!guard.ok) return guard.response;

    // Shares `blackoutDateSchema` with the collection route. The two used to
    // carry separate hand-rolled copies of these rules.
    const parsed = blackoutDateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { startDate, endDate, reason, type, startTime, endTime } =
      parsed.data;

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

    // Check if blackout date exists
    const existingBlackoutDate = await BlackoutDate.findById(id);
    if (!existingBlackoutDate) {
      return NextResponse.json(
        { message: "Blackout date not found" },
        { status: 404 },
      );
    }

    // Update blackout date using createLocalDate to avoid timezone shifts.
    //
    // Fields that should be cleared go through $unset: Mongoose *skips*
    // undefined values in an update rather than removing them, so narrowing a
    // multi-day blackout left the old `endDate` in place and switching
    // time_range → full_day left stale times. Either way the blackout kept
    // blocking its original, wider range.
    const $set: Record<string, unknown> = {
      startDate: parsedStart,
      type,
      updatedAt: new Date(),
    };
    const $unset: Record<string, ""> = {};

    if (endDate) {
      $set.endDate = parsedEnd;
    } else {
      $unset.endDate = "";
    }

    if (reason) {
      $set.reason = reason;
    } else {
      $unset.reason = "";
    }

    if (type === "time_range") {
      $set.startTime = startTime;
      $set.endTime = endTime;
    } else {
      $unset.startTime = "";
      $unset.endTime = "";
    }

    const updatedBlackoutDate = await BlackoutDate.findByIdAndUpdate(
      id,
      Object.keys($unset).length > 0 ? { $set, $unset } : { $set },
      { new: true, runValidators: true },
    );

    // The existence check above is a separate query, so a concurrent DELETE
    // left this null — which was serialised as a 200 with a `null` body.
    if (!updatedBlackoutDate) {
      return NextResponse.json(
        { message: "Blackout date not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedBlackoutDate);
  } catch (error) {
    console.error("Error updating blackout date:", error);

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
      { message: "Failed to update blackout date" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/blackout-dates/[id] - Delete blackout date
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

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
