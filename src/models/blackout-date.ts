import mongoose from "mongoose";

export type BlackoutDateType = "full_day" | "time_range";

const blackoutDateSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: false },
    reason: { type: String, required: false, maxlength: 500 },
    type: {
      type: String,
      required: true,
      enum: ["full_day", "time_range"],
      default: "full_day",
    },
    startTime: { type: String, required: false },
    endTime: { type: String, required: false },
    createdBy: { type: String, required: true, default: "admin" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "blackout_dates",
  },
);

// Create indexes for efficient date range queries
blackoutDateSchema.index({ startDate: 1, endDate: 1 });

// Update timestamps before saving
blackoutDateSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Validation for date ranges
blackoutDateSchema.pre("save", function (next) {
  if (this.endDate && this.startDate > this.endDate) {
    return next(new Error("End date must be after start date"));
  }
  next();
});

// Validation for time ranges
blackoutDateSchema.pre("save", function (next) {
  if (this.type === "time_range") {
    if (!this.startTime || !this.endTime) {
      return next(
        new Error("Start time and end time are required for time_range type"),
      );
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(this.startTime) || !timeRegex.test(this.endTime)) {
      return next(new Error("Times must be in HH:MM format"));
    }

    if (this.startTime >= this.endTime) {
      return next(new Error("End time must be after start time"));
    }
  }
  next();
});

// Only create the model if it hasn't been created already
export const BlackoutDate =
  (mongoose.models && mongoose.models.BlackoutDate) ||
  mongoose.model("BlackoutDate", blackoutDateSchema);

export type BlackoutDateDocument = mongoose.Document & {
  startDate: Date;
  endDate?: Date;
  reason?: string;
  type: BlackoutDateType;
  startTime?: string;
  endTime?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

// Helper function to check if a date falls within a blackout period
export function isDateBlackedOut(
  checkDate: Date,
  blackoutDates: BlackoutDateDocument[],
): boolean {
  return blackoutDates.some((blackout) => {
    const startDate = new Date(blackout.startDate);
    const endDate = blackout.endDate ? new Date(blackout.endDate) : startDate;

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
