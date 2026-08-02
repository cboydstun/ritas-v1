import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import {
  BlackoutDate,
  isDateBlackedOut,
  type BlackoutDateDocument,
} from "@/models/blackout-date";
import type { MachineType } from "@/types";

export type InventoryCheckResult = {
  available: boolean;
  reason?: string;
};

/**
 * Used only when there is no Settings document, or none configured for a type.
 * Must match the `Settings.machines.*.inventory` schema defaults, otherwise
 * availability silently changes the first time an admin saves settings.
 */
const DEFAULT_INVENTORY: Record<MachineType, number> = {
  single: 3,
  double: 3,
  triple: 2,
};

/**
 * How long an unpaid hold keeps a unit off the board.
 *
 * `pending` / `pending_payment` rentals count against availability, and
 * nothing ever expired them — so every abandoned checkout consumed a unit
 * permanently. `releaseStaleHolds` cancels them past this age.
 */
export const STALE_HOLD_MINUTES = 120;

function eachDayInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  for (
    let cursor = new Date(startDate);
    cursor <= endDate;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

export async function getMachineInventory(
  machineType: MachineType,
): Promise<number> {
  const settings = (await Settings.findOne({ key: "global" }).lean()) as {
    machines?: {
      single?: { inventory?: number };
      double?: { inventory?: number };
      triple?: { inventory?: number };
    };
  } | null;

  const configured = settings?.machines?.[machineType]?.inventory;
  if (typeof configured === "number" && configured >= 0) {
    return configured;
  }
  return DEFAULT_INVENTORY[machineType];
}

/**
 * Cancel unpaid holds older than `olderThanMinutes` so their units return to
 * the pool. Safe to call repeatedly; returns how many were released.
 */
export async function releaseStaleHolds(
  olderThanMinutes: number = STALE_HOLD_MINUTES,
): Promise<number> {
  await dbConnect();

  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const result = await Rental.updateMany(
    {
      status: { $in: ["pending", "pending_payment"] },
      createdAt: { $lt: cutoff },
    },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );

  return result.modifiedCount ?? 0;
}

export interface AvailabilityOptions {
  /**
   * A rental to leave out of the overlap count — used when re-checking after
   * persisting a hold, so a booking is never blocked by its own reservation.
   */
  excludeRentalId?: string;
}

export async function isMachineAvailable(
  machineType: MachineType,
  capacity: 15 | 30 | 45,
  rentalDate: string,
  returnDate?: string,
  options?: AvailabilityOptions,
): Promise<InventoryCheckResult> {
  await dbConnect();

  const endDate = returnDate ?? rentalDate;
  const days = eachDayInRange(rentalDate, endDate);

  const blackoutDates = (await BlackoutDate.find({
    $or: [
      {
        startDate: { $lte: new Date(endDate + "T00:00:00") },
        endDate: { $gte: new Date(rentalDate + "T00:00:00") },
      },
      {
        startDate: { $lte: new Date(endDate + "T00:00:00") },
        endDate: { $exists: false },
      },
    ],
  })) as BlackoutDateDocument[];

  for (const day of days) {
    if (isDateBlackedOut(new Date(day + "T00:00:00"), blackoutDates)) {
      return {
        available: false,
        reason: "Date is not available due to blackout period",
      };
    }
  }

  const inventory = await getMachineInventory(machineType);
  if (inventory <= 0) {
    return {
      available: false,
      reason: "This machine type is not currently available",
    };
  }

  const overlapQuery: Record<string, unknown> = {
    machineType,
    capacity,
    status: { $in: ["pending", "pending_payment", "confirmed", "in-progress"] },
    rentalDate: { $lte: endDate },
    returnDate: { $gte: rentalDate },
  };
  if (options?.excludeRentalId) {
    overlapQuery._id = { $ne: options.excludeRentalId };
  }

  const overlapping = await Rental.find(overlapQuery)
    .select("rentalDate returnDate")
    .lean();

  for (const day of days) {
    const booked = overlapping.filter(
      (r) => r.rentalDate <= day && r.returnDate >= day,
    ).length;
    if (booked >= inventory) {
      return {
        available: false,
        reason:
          "All units of this machine are booked for one or more selected dates",
      };
    }
  }

  return { available: true };
}
