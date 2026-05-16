import { NextResponse } from "next/server";
import { isMachineAvailable } from "@/lib/inventory";
import { MachineType } from "@/types";

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
