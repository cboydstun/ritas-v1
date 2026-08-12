import mongoose from "mongoose";

import type { BlackoutDateType } from "@/lib/blackout-dates";

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
blackoutDateSchema.pre("save", function () {
  this.updatedAt = new Date();
});

// Validation for date ranges
blackoutDateSchema.pre("save", function () {
  if (this.endDate && this.startDate > this.endDate) {
    throw new Error("End date must be after start date");
  }
});

/**
 * Messages the `pre("save")` hooks below throw.
 *
 * They are plain Errors, not mongoose ValidationErrors, so route handlers have
 * no type to test against. Exporting the set lets them answer 400 instead of
 * reporting an admin's bad input as a server fault.
 */
export const MODEL_RULE_MESSAGES = new Set([
  "End date must be after start date",
  "Start time and end time are required for time_range type",
  "Times must be in HH:MM format",
  "End time must be after start time",
]);

// Validation for time ranges
blackoutDateSchema.pre("save", function () {
  if (this.type === "time_range") {
    if (!this.startTime || !this.endTime) {
      throw new Error(
        "Start time and end time are required for time_range type",
      );
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(this.startTime) || !timeRegex.test(this.endTime)) {
      throw new Error("Times must be in HH:MM format");
    }

    if (this.startTime >= this.endTime) {
      throw new Error("End time must be after start time");
    }
  }
});

// Only create the model if it hasn't been created already
export const BlackoutDate =
  (mongoose.models && mongoose.models.BlackoutDate) ||
  mongoose.model("BlackoutDate", blackoutDateSchema);

/**
 * The mongoose Document type. Server-side only — client components should use
 * `BlackoutDateRecord` from `@/lib/blackout-dates`, which is the serialised
 * shape they actually receive and carries no mongoose import.
 */
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

// Re-exported so existing server-side imports keep working from one place.
export {
  isDateBlackedOut,
  formatDateForCentralTime,
  createLocalDate,
  createCentralTimeDate,
} from "@/lib/blackout-dates";
export type {
  BlackoutDateType,
  BlackoutDateRecord,
} from "@/lib/blackout-dates";
