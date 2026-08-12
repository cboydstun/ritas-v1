import { z } from "zod";
import type { MachineType } from "@/types";
import { LEASE_BUSINESS_TYPES, LEASE_TERMS } from "@/lib/lease-data";
import {
  todayLocalIso,
  spanInDays,
  PHONE_PATTERN,
  ZIP_PATTERN,
  EMAIL_PATTERN,
} from "@/lib/dates";
import {
  BLOG_STATUSES,
  MAX_BODY_LENGTH,
  MAX_EXCERPT_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_TITLE_LENGTH,
  SLUG_PATTERN,
  hasDangerousHtml,
  isSafeCoverImagePath,
} from "@/lib/blog";

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

/**
 * A mixer id. The valid set is dynamic — an admin can add flavours in
 * `/admin/settings` and `MachineStep` renders a card for each — so membership
 * is checked against the catalog at the route layer (`resolveSelectedMixers`)
 * rather than pinned to an enum here. Pinning it to the static four rejected
 * every booking that used an admin-added flavour, with the raw Zod message
 * shown to the customer.
 */
export const mixerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/i, "Invalid mixer");

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

// Re-exported from `@/lib/dates` so client components can reach them without
// pulling zod into the browser bundle. Server code may import from either.
export { BUSINESS_TIME_ZONE, todayLocalIso } from "@/lib/dates";

const addressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(50),
  zipCode: z.string().trim().regex(ZIP_PATTERN, "Invalid ZIP code"),
});

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .regex(EMAIL_PATTERN, "Invalid email address")
    .max(200),
  phone: z.string().trim().regex(PHONE_PATTERN, "Invalid phone number"),
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

export const rentalDataSchema = z
  .object({
    machineType: machineTypeSchema,
    // `capacity` is accepted for backwards compatibility but ignored — the
    // server derives it from machineType. Sending a mismatched pair used to
    // slip past every availability check.
    capacity: z.union([z.literal(15), z.literal(30), z.literal(45)]).optional(),
    selectedMixers: z.array(mixerIdSchema).max(3).default([]),
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
  .refine(
    (data) => spanInDays(data.rentalDate, data.returnDate) <= MAX_RANGE_DAYS,
    {
      message: `Rental cannot exceed ${MAX_RANGE_DAYS} days`,
      path: ["returnDate"],
    },
  )
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
    email: z
      .string()
      .trim()
      .regex(EMAIL_PATTERN, "Invalid email address")
      .max(200),
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
    email: z
      .string()
      .trim()
      .regex(EMAIL_PATTERN, "Invalid email address")
      .max(200),
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

/**
 * Admin settings body validation.
 *
 * `PUT /api/admin/settings` writes through `findOneAndUpdate`, and
 * `runValidators` runs *path* validators only — the `pre("validate")` document
 * hook in `src/models/settings.ts` that enforces `deliveryWindowEndHour >
 * deliveryWindowStartHour` never fires on a query update. `mixers`, `extras`
 * and `leaseTiers` are `Schema.Types.Mixed`, which Mongoose does not
 * deep-validate at all, so a string where a number belongs reached
 * `calculatePrice` and produced a `NaN` order total.
 *
 * This schema is where both classes of write are actually checked.
 */
const rateSchema = z.number().min(0).max(1);
const moneySchema = z.number().min(0).max(100_000);

/** A Mixed map entry only has to carry a usable `price` — labels are free text. */
const pricedEntrySchema = z
  .object({ price: moneySchema })
  .catchall(z.unknown());

const machineSettingsSchema = z
  .object({
    basePrice: moneySchema,
    inventory: z.number().int().min(0).max(1000),
  })
  .partial();

export const settingsUpdateSchema = z
  .object({
    fees: z
      .object({
        deliveryFee: moneySchema,
        salesTaxRate: rateSchema,
        processingFeeRate: rateSchema,
        serviceDiscountRate: rateSchema,
      })
      .partial(),
    machines: z
      .object({
        single: machineSettingsSchema,
        double: machineSettingsSchema,
        triple: machineSettingsSchema,
      })
      .partial(),
    mixers: z.record(z.string(), pricedEntrySchema),
    extras: z.record(z.string(), pricedEntrySchema),
    leaseTiers: z.record(z.string(), z.object({}).catchall(z.unknown())),
    operations: z
      .object({
        deliveryWindowStartHour: z.number().int().min(0).max(23),
        deliveryWindowEndHour: z.number().int().min(0).max(23),
      })
      .partial(),
    documentation: z
      .object({
        // Rendered straight into an href on the public /long-term-lease
        // page, so an unrestricted string was a stored-XSS sink: React 19 no
        // longer warns on a `javascript:` href.
        pdfUrl: z
          .string()
          .max(2000)
          .refine((url) => url === "" || /^https?:\/\//i.test(url), {
            message: "pdfUrl must be an http(s) URL",
          }),
        pdfLabel: z.string().max(200),
      })
      .partial(),
  })
  .partial()
  .superRefine((value, ctx) => {
    const ops = value.operations;
    // Only checkable when the caller sends both halves; a partial write that
    // touches one hour is re-checked against the stored document in the route.
    if (
      ops?.deliveryWindowStartHour !== undefined &&
      ops?.deliveryWindowEndHour !== undefined &&
      ops.deliveryWindowStartHour >= ops.deliveryWindowEndHour
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["operations", "deliveryWindowEndHour"],
        message:
          "deliveryWindowEndHour must be greater than deliveryWindowStartHour",
      });
    }
  });

/**
 * Blackout-date create/update body.
 *
 * This was the one write path in the app still validating by hand, with the
 * same ~50 lines duplicated across the collection and [id] handlers and free
 * to drift apart. `reason` was also unbounded and untyped.
 */
const blackoutTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must be in HH:MM format");

export const blackoutDateSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional(),
    reason: z.string().trim().max(500).optional(),
    type: z.enum(["full_day", "time_range"]),
    startTime: blackoutTimeSchema.optional(),
    endTime: blackoutTimeSchema.optional(),
  })
  .refine(
    (data) => data.endDate === undefined || data.endDate >= data.startDate,
    { message: "End date must be on or after start date", path: ["endDate"] },
  )
  .refine(
    (data) =>
      data.type !== "time_range" ||
      (data.startTime !== undefined && data.endTime !== undefined),
    {
      message: "Start time and end time are required for time_range type",
      path: ["startTime"],
    },
  )
  .refine(
    (data) =>
      data.type !== "time_range" ||
      data.startTime === undefined ||
      data.endTime === undefined ||
      data.startTime < data.endTime,
    { message: "End time must be after start time", path: ["endTime"] },
  );

export type BlackoutDateInput = z.infer<typeof blackoutDateSchema>;

/**
 * Blog post writes (`/api/admin/blog`).
 *
 * The admin surface is authenticated, but these routes still parse rather than
 * trust: the same field-whitelist discipline every other write path in this
 * app follows. `.strip()` drops anything not named here, so a body carrying
 * `_id`, `createdAt` or `author` cannot reach the update document.
 */
export const blogSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(MAX_SLUG_LENGTH)
  .regex(SLUG_PATTERN, "Slug must be lowercase words separated by hyphens");

/**
 * Rejects the obvious script-injection shapes. This is defense-in-depth, not
 * sanitisation — see `hasDangerousHtml`. The control that matters is the
 * session check on the route.
 */
const blogBodySchema = z
  .string()
  .min(1, "Body is required")
  .max(MAX_BODY_LENGTH)
  .refine((value) => !hasDangerousHtml(value), {
    message:
      "Body contains a script, iframe, inline event handler or scheme URL",
  });

/**
 * Site-relative only, which is what keeps `next.config.ts` `remotePatterns`
 * and the CSP `img-src` out of this feature entirely.
 */
const coverImagePathSchema = z
  .string()
  .trim()
  .max(300)
  .refine(isSafeCoverImagePath, {
    message: "Cover image must be a site-relative path such as /images/foo.jpg",
  });

const blogPostFields = {
  slug: blogSlugSchema,
  title: z.string().trim().min(1, "Title is required").max(MAX_TITLE_LENGTH),
  excerpt: z.string().trim().max(MAX_EXCERPT_LENGTH).optional(),
  body: blogBodySchema,
  coverImagePath: coverImagePathSchema.optional(),
  coverImageAlt: z.string().trim().max(200).optional(),
  tags: z
    .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
    .max(MAX_TAGS)
    .optional(),
  status: z.enum(BLOG_STATUSES).optional(),
  seoTitle: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  seoDescription: z.string().trim().max(MAX_EXCERPT_LENGTH).optional(),
};

export const blogPostCreateSchema = z.object(blogPostFields).strip();

/**
 * Every field optional, but not *no* fields: an empty PUT would otherwise be a
 * 200 that wrote nothing but a fresh `updatedAt`, which reads as a successful
 * save in the admin UI.
 */
export const blogPostUpdateSchema = z
  .object(blogPostFields)
  .partial()
  .strip()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No editable fields supplied",
  });

export type BlogPostInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;

/** Collapse a ZodError into a single short, non-leaky message. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Re-exported so server code can keep importing date helpers from here. */
export { spanInDays };
