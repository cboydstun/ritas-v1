import { NextResponse } from "next/server";
import { isMachineAvailable } from "@/lib/inventory";
import { MACHINE_CAPACITY, MAX_RANGE_DAYS, spanInDays } from "@/lib/validation";
import { MachineType } from "@/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const machineType = url.searchParams.get("machineType") as MachineType;
    const date = url.searchParams.get("date");
    const returnDateParam = url.searchParams.get("returnDate");

    if (!machineType || !date) {
      return NextResponse.json(
        {
          message:
            "Missing required parameters: machineType and date are required",
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

    // Capacity is derived, never read from the query. `isMachineAvailable`
    // filters overlapping rentals by capacity while inventory is keyed off
    // machineType alone, so a mismatched pair (?machineType=triple&capacity=15)
    // matched zero overlaps and reported a fully booked date as available.
    // A `capacity` param is still accepted, and ignored, so an in-flight
    // client from a previous deploy keeps working.
    const capacity = MACHINE_CAPACITY[machineType];

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
      capacity,
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
