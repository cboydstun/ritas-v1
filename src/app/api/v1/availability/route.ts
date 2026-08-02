import { NextResponse } from "next/server";
import { isMachineAvailable } from "@/lib/inventory";
import { MachineType } from "@/types";

/** Longest rental window the availability check will expand. */
const MAX_RANGE_DAYS = 90;

function spanInDays(start: string, end: string): number {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(end) - toUtc(start)) / (1000 * 60 * 60 * 24));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const machineType = url.searchParams.get("machineType") as MachineType;
    const capacityParam = url.searchParams.get("capacity");
    const date = url.searchParams.get("date");
    const returnDateParam = url.searchParams.get("returnDate");

    if (!machineType || !capacityParam || !date) {
      return NextResponse.json(
        {
          message:
            "Missing required parameters: machineType, capacity, and date are required",
        },
        { status: 400 },
      );
    }

    if (!["single", "double", "triple"].includes(machineType)) {
      return NextResponse.json(
        {
          message:
            "Invalid machineType. Must be 'single', 'double', or 'triple'",
        },
        { status: 400 },
      );
    }

    const capacity = parseInt(capacityParam, 10);
    if (![15, 30, 45].includes(capacity)) {
      return NextResponse.json(
        { message: "Invalid capacity. Must be 15, 30, or 45" },
        { status: 400 },
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { message: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    if (returnDateParam) {
      if (!dateRegex.test(returnDateParam)) {
        return NextResponse.json(
          { message: "Invalid returnDate format. Use YYYY-MM-DD" },
          { status: 400 },
        );
      }
      if (returnDateParam < date) {
        return NextResponse.json(
          { message: "returnDate must be on or after date" },
          { status: 400 },
        );
      }
      // The range is expanded day by day, so an unbounded span (?date=1000-01-01
      // &returnDate=9999-12-31) burns seconds of CPU per anonymous request.
      if (spanInDays(date, returnDateParam) > MAX_RANGE_DAYS) {
        return NextResponse.json(
          { message: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
          { status: 400 },
        );
      }
    }

    const result = await isMachineAvailable(
      machineType,
      capacity as 15 | 30 | 45,
      date,
      returnDateParam ?? undefined,
    );

    return NextResponse.json({
      available: result.available,
      machineType,
      capacity,
      date,
      ...(returnDateParam ? { returnDate: returnDateParam } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (error) {
    console.error("Error checking machine availability:", error);
    return NextResponse.json(
      { message: "Failed to check machine availability" },
      { status: 500 },
    );
  }
}
