import mongoose from "mongoose";
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
 * How long an abandoned `pending` hold keeps a unit off the board.
 *
 * Only `pending` expires. `pending_payment` is the status `/api/save-booking`
 * writes for a *submitted* booking — the customer has a confirmation email and
 * is invoiced out of band — so it blocks its unit until an admin cancels it.
 * Reaping it cancelled real bookings two hours after they were placed and put
 * the machine back on sale.
 *
 * `isMachineAvailable` enforces the cutoff at query time, so an abandoned hold
 * stops blocking a unit the moment it ages out. `releaseStaleHolds` then flips
 * the stored status to "cancelled" as housekeeping — it keeps the admin views
 * honest but is not what makes availability correct.
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

/** Internal: not exported — the only caller is `isMachineAvailable` below. */
async function getMachineInventory(machineType: MachineType): Promise<number> {
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
 * Cancel abandoned `pending` holds older than `olderThanMinutes` so their units
 * return to the pool. `pending_payment` is deliberately excluded — see the note
 * on STALE_HOLD_MINUTES. Safe to call repeatedly; returns how many were released.
 */
export async function releaseStaleHolds(
  olderThanMinutes: number = STALE_HOLD_MINUTES,
): Promise<number> {
  await dbConnect();

  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const result = await Rental.updateMany(
    {
      status: "pending",
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
  /**
   * Ignore rentals created at or after this instant.
   *
   * Makes the post-write oversell recheck asymmetric. Without it, two requests
   * racing for the last unit each saw the other's hold and each rolled itself
   * back, so both customers were rejected and the unit went unsold. Passing
   * our own `createdAt` means only holds that were already there can displace
   * us, so exactly one of the two survives.
   */
  ignoreCreatedFrom?: Date;
  /**
   * Our own `_id`, used to break a `createdAt` tie deterministically.
   *
   * `createdAt` comes from `default: Date.now`, so two requests constructed in
   * the same millisecond each fell outside the other's `$lt` cutoff, both
   * survived the recheck, and inventory went one over. ObjectIds are unique,
   * so comparing them settles which of the two counts as "already there".
   */
  tieBreakId?: string;
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

  // An abandoned `pending` hold stops counting once it is older than
  // STALE_HOLD_MINUTES, whether or not `releaseStaleHolds` has cancelled it
  // yet. Expiry is treated as a property of the query rather than of the
  // stored document, so availability is correct even if the cleanup job is
  // delayed or never runs. `pending_payment` is a submitted booking and never
  // expires — see the note on STALE_HOLD_MINUTES.
  const holdCutoff = new Date(Date.now() - STALE_HOLD_MINUTES * 60 * 1000);

  const overlapQuery: Record<string, unknown> = {
    machineType,
    capacity,
    rentalDate: { $lte: endDate },
    returnDate: { $gte: rentalDate },
    $or: [
      { status: { $in: ["confirmed", "in-progress", "pending_payment"] } },
      {
        status: "pending",
        createdAt: { $gte: holdCutoff },
      },
    ],
  };
  if (options?.excludeRentalId) {
    overlapQuery._id = { $ne: options.excludeRentalId };
  }
  if (options?.ignoreCreatedFrom) {
    const cutoff = options.ignoreCreatedFrom;
    if (options.tieBreakId) {
      // Strictly earlier, or the same millisecond with a lower _id. Without
      // the second clause a same-millisecond tie let both racers through.
      overlapQuery.$and = [
        {
          $or: [
            { createdAt: { $lt: cutoff } },
            {
              createdAt: cutoff,
              _id: { $lt: new mongoose.Types.ObjectId(options.tieBreakId) },
            },
          ],
        },
      ];
    } else {
      overlapQuery.createdAt = { $lt: cutoff };
    }
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
