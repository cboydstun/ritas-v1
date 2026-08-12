/**
 * Blackout-date shapes and date helpers, with no mongoose import.
 *
 * These lived in `src/models/blackout-date.ts`. Admin client components need
 * the record type and `formatDateForCentralTime`, and importing them from the
 * model dragged mongoose — and the whole mongodb driver — into the browser
 * bundle. Next 15 tolerated that; Next 16 fails the build on it, which is the
 * correct call.
 */

export type BlackoutDateType = "full_day" | "time_range";

/**
 * A blackout date as the API serialises it. This is what a client component
 * actually receives — JSON, not a hydrated mongoose Document.
 */
export interface BlackoutDateRecord {
  _id?: string;
  startDate: Date | string;
  endDate?: Date | string;
  reason?: string;
  type: BlackoutDateType;
  startTime?: string;
  endTime?: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Helper function to check if a date falls within a blackout period
/**
 * Whether a calendar day is blacked out.
 *
 * Deliberately ignores `type`/`startTime`/`endTime`: availability is decided
 * per day, with no delivery time in scope, so a `time_range` blackout blocks
 * the whole day. The admin form no longer offers that type for exactly this
 * reason — honouring the window means threading a delivery time through
 * `isMachineAvailable` first.
 */
export function isDateBlackedOut(
  checkDate: Date,
  blackoutDates: Pick<BlackoutDateRecord, "startDate" | "endDate">[],
): boolean {
  return blackoutDates.some((blackout) => {
    // `new Date("2026-07-04")` is UTC midnight, which is the 3rd in Central —
    // so a record whose dates arrived as ISO strings (anything read back from
    // the API rather than straight out of mongoose) blacked out the wrong day,
    // one earlier, for its whole range. `createLocalDate` parses a date-only
    // string as local midnight, matching how the value was written.
    const startDate = toLocalDate(blackout.startDate);
    const endDate = blackout.endDate
      ? toLocalDate(blackout.endDate)
      : startDate;

    // Set times to start of day for date comparison
    const checkDateStart = new Date(checkDate);
    checkDateStart.setHours(0, 0, 0, 0);

    const blackoutStart = new Date(startDate);
    blackoutStart.setHours(0, 0, 0, 0);

    const blackoutEnd = new Date(endDate);
    blackoutEnd.setHours(23, 59, 59, 999);

    return checkDateStart >= blackoutStart && checkDateStart <= blackoutEnd;
  });
}

/** A stored blackout bound, however it arrived, as a local Date. */
function toLocalDate(value: Date | string): Date {
  return typeof value === "string" ? createLocalDate(value) : new Date(value);
}

// Helper function to format date for display (handles both UTC dates from DB and local dates)
export function formatDateForCentralTime(date: Date | string): string {
  // Convert to Date object if it's a string
  let dateObj: Date;

  if (typeof date === "string") {
    // If it's a string, parse it as a local date to avoid timezone shifts
    if (date.includes("T")) {
      // If it's an ISO string with time, parse it normally
      dateObj = new Date(date);
    } else {
      // If it's a date string like "2025-07-28" or "07/28/2025", treat it as local date
      // Split and reconstruct to ensure local interpretation
      const parts = date.includes("-") ? date.split("-") : date.split("/");
      if (parts.length === 3) {
        if (date.includes("-")) {
          // Format: YYYY-MM-DD
          const [year, month, day] = parts;
          dateObj = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
        } else {
          // Format: MM/DD/YYYY
          const [month, day, year] = parts;
          dateObj = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
        }
      } else {
        // Fallback to regular parsing
        dateObj = new Date(date);
      }
    }
  } else {
    dateObj = date;
  }

  // Check if the date is valid
  if (!dateObj || isNaN(dateObj.getTime())) {
    return "Invalid Date";
  }

  // For dates from MongoDB (which are stored as UTC), we need to extract the date components
  // using UTC methods to avoid timezone conversion issues, then interpret them as local date components
  let year: number;
  let month: number;
  let day: number;

  // Check if this looks like a UTC date from MongoDB (has time component and is at midnight UTC)
  const timeString = dateObj.toISOString();
  const isUTCMidnight =
    timeString.includes("T00:00:00.000Z") ||
    timeString.includes("T05:00:00.000Z");

  if (isUTCMidnight) {
    // This is likely a date from MongoDB stored as UTC midnight
    // Extract the date components from UTC to avoid timezone conversion
    year = dateObj.getUTCFullYear();
    month = dateObj.getUTCMonth() + 1;
    day = dateObj.getUTCDate();
  } else {
    // This is a regular date, use local time components
    year = dateObj.getFullYear();
    month = dateObj.getMonth() + 1;
    day = dateObj.getDate();
  }

  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");

  return `${monthStr}/${dayStr}/${year}`;
}

// Helper function to create a Date object in local time (avoiding timezone shifts)
export function createLocalDate(dateString: string): Date {
  // Callers pass values straight out of a request body. A non-string used to
  // throw a TypeError on `.includes`, which surfaced as a 500 rather than the
  // 400 the input deserves.
  if (typeof dateString !== "string") {
    return new Date(NaN);
  }

  // Parse the date string and create a date in local time
  if (dateString.includes("T")) {
    // Already has time component
    return new Date(dateString);
  }

  // For date-only strings, create as local date to avoid timezone shifts
  const parts = dateString.includes("-")
    ? dateString.split("-")
    : dateString.split("/");
  if (parts.length === 3) {
    if (dateString.includes("-")) {
      // Format: YYYY-MM-DD
      const [year, month, day] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Format: MM/DD/YYYY
      const [month, day, year] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  // Fallback
  return new Date(dateString);
}

// Helper function to create a Date object in Central Time (deprecated - use createLocalDate)
export function createCentralTimeDate(dateString: string): Date {
  return createLocalDate(dateString);
}
