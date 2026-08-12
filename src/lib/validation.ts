import { z } from "zod";
import type { MachineType } from "@/types";
import { LEASE_BUSINESS_TYPES, LEASE_TERMS } from "@/lib/lease-data";

/**
 * Request-body validation for the public API routes.
 *
 * These endpoints previously spread unvalidated JSON straight into Mongoose
 * (`new Rental({ ...body })`, `Contact.create(body)`), which let callers set
 * fields the UI never exposes and turned malformed input into 500s instead of
 * 400s. Every public write now parses through a schema here first.
 */

/** Tank count per machine type — the only valid pairing. */
export const MACHINE_CAPACITY: Record<MachineType, 15 | 30 | 45> = {
  single: 15,
  double: 30,
  triple: 45,
};

export const machineTypeSchema = z.enum(["single", "double", "triple"]);

export const mixerTypeSchema = z.enum([
  "non-alcoholic",
  "margarita",
  "pina-colada",
  "strawberry-daiquiri",
]);

/** YYYY-MM-DD that also has to be a real calendar date. */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Not a valid calendar date");

/** HH:MM, or the "ANY" sentinel the delivery-window picker uses. */
export const timeStringSchema = z
  .string()
  .regex(/^(ANY|([01]\d|2[0-3]):[0-5]\d)$/, "Invalid time");

/**
 * Today in the business's timezone as YYYY-MM-DD.
 *
 * Deliberately not the server clock: Vercel functions run UTC, so after 19:00
 * Central the server was already on tomorrow's date and rejected same-day
 * bookings that the client's date picker had just offered. `en-CA` formats as
 * YYYY-MM-DD, which is the format used throughout this codebase.
 */
export const BUSINESS_TIME_ZONE = "America/Chicago";

export function todayLocalIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const addressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(50),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
});

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$/, "Invalid phone number"),
  address: addressSchema,
});

/**
 * A selected add-on as it may arrive over the wire: an id, and optionally a
 * quantity. Price and pricingType are deliberately absent — those come from
 * the server catalog in `@/lib/extras-catalog`, never from the request.
 */
const selectedExtraSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(20).optional(),
  })
  .strip();

/** Longest rental window the availability check will expand. */
export const MAX_RANGE_DAYS = 90;

/** Whole days between two YYYY-MM-DD strings, diffed as UTC calendar dates. */
export function spanInDays(start: string, end: string): number {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
}

export const rentalDataSchema = z
  .object({
    machineType: machineTypeSchema,
    // `capacity` is accepted for backwards compatibility but ignored — the
    // server derives it from machineType. Sending a mismatched pair used to
    // slip past every availability check.
    capacity: z.union([z.literal(15), z.literal(30), z.literal(45)]).optional(),
    selectedMixers: z.array(mixerTypeSchema).max(3).default([]),
    selectedExtras: z.array(selectedExtraSchema).max(20).default([]),
    rentalDate: dateStringSchema,
    rentalTime: timeStringSchema,
    returnDate: dateStringSchema,
    returnTime: timeStringSchema,
    customer: customerSchema,
    notes: z.string().trim().max(1000).default(""),
  })
  .strip()
  .refine((data) => data.returnDate >= data.rentalDate, {
    message: "Return date must be on or after the rental date",
    path: ["returnDate"],
  })
  .refine((data) => data.rentalDate >= todayLocalIso(), {
    message: "Rental date cannot be in the past",
    path: ["rentalDate"],
  })
  // The range is expanded day by day downstream, so an unbounded span
  // (returnDate: "9999-12-31") burns seconds of CPU per request.
  .refine((data) => spanInDays(data.rentalDate, data.returnDate) <= MAX_RANGE_DAYS, {
    message: `Rental cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["returnDate"],
  })
  .refine(
    (data) => data.selectedMixers.length <= maxMixersFor(data.machineType),
    {
      message: "Too many mixers for the selected machine",
      path: ["selectedMixers"],
    },
  );

export type ValidatedRentalData = z.infer<typeof rentalDataSchema>;

function maxMixersFor(machineType: MachineType): number {
  return machineType === "single" ? 1 : machineType === "double" ? 2 : 3;
}

export const contactSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(1).max(30),
    // Kept loose: the contact form lets people describe a date freely.
    eventDate: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(2000),
  })
  .strip();

export const leaseInquirySchema = z
  .object({
    businessName: z.string().trim().min(1).max(200),
    businessType: z.enum(LEASE_BUSINESS_TYPES),
    contactName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(1).max(30),
    address: z.object({
      street: z.string().trim().min(1).max(200),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(1).max(50),
      zip: z.string().trim().min(1).max(20),
    }),
    preferredTerm: z.enum(LEASE_TERMS),
    machinesOfInterest: z
      .array(z.enum(["single-15", "double-30", "triple-45"]))
      .max(3)
      .default([]),
    message: z.string().trim().max(2000).default(""),
  })
  .strip();

/** Thumbmark hashes are hex digests; anything else is an injection attempt. */
export const fingerprintHashSchema = z
  .string()
  .regex(/^[a-f0-9]{16,128}$/i, "Invalid fingerprint hash");

/**
 * Escape a value for interpolation into an HTML email body. Customer-supplied
 * names, addresses and notes are rendered in the operator's inbox, so raw
 * interpolation lets a submitter inject markup and links.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapse a ZodError into a single short, non-leaky message. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
