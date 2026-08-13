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
  MAX_FOCUS_KEYWORD_LENGTH,
  MAX_TITLE_LENGTH,
  SLUG_PATTERN,
  hasDangerousHtml,
  isSafeCoverImagePath,
} from "@/lib/blog";
import {
  LANDING_STATUSES,
  MAX_BREADCRUMBS,
  MAX_DESCRIPTION_LENGTH,
  MAX_HEADING_LENGTH,
  MAX_HREF_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_PATH_LENGTH,
  MAX_RICH_TEXT_LENGTH,
  MAX_SECTIONS,
  MAX_SECTION_ITEMS,
  MAX_TEXT_LENGTH,
  SCHEMA_TYPES,
  isLandingPath,
  isReservedPath,
  isSafeHref,
} from "@/lib/landing";

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
  // The empty case is explicit because `.optional()` alone does not cover it:
  // `""` is *present*, so the refine runs and rejects, and the admin form
  // sends `formData.coverImagePath.trim()` unconditionally. That combination
  // made every save without a cover image a 400 and left the `$unset` branch
  // in the PUT route unreachable, so a cover image could never be removed.
  // Any optional field with a refine or a `.min(1)` needs this escape.
  .refine((value) => value === "" || isSafeCoverImagePath(value), {
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
  focusKeyword: z.string().trim().max(MAX_FOCUS_KEYWORD_LENGTH).optional(),
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

/**
 * Landing page and shared block writes (`/api/admin/landing-pages`,
 * `/api/admin/shared-blocks`).
 *
 * **This is the only real validation on `sections`.** That path is `Mixed` on
 * both models, so mongoose neither casts nor deep-validates it, and
 * `runValidators` on a query update runs path validators only — the same trap
 * documented on `settingsUpdateSchema` above. The models carry a shallow
 * `sectionShapeError` net for anything that reaches a document without going
 * through a route; everything below is what actually checks field contents.
 */

/**
 * Optional, and tolerant of the empty string an admin form sends for a blank
 * field. `.optional()` alone permits only `undefined`, so a refined optional
 * field rejects `""` — the bug fixed on `coverImagePathSchema` above.
 */
function optionalOrBlank<T extends z.ZodType<string, string>>(schema: T) {
  return z.union([z.literal(""), schema]).optional();
}

const landingPathSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_PATH_LENGTH)
  .refine(isLandingPath, {
    message:
      "Path must be lowercase slug segments beginning with a slash, e.g. /service-area/olmos-park",
  })
  // A page at a real route would save and then never render, because Next
  // always prefers a static or `[param]` route over the root catch-all. 400,
  // not 409 — 409 stays reserved for the duplicate-path key error.
  .refine((value) => !isReservedPath(value), {
    message: "That path is reserved by an existing route",
  });

const headingSchema = z.string().trim().max(MAX_HEADING_LENGTH);
const bodyTextSchema = z.string().trim().max(MAX_TEXT_LENGTH);
const linkLabelSchema = z.string().trim().min(1).max(MAX_LABEL_LENGTH);

const hrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_HREF_LENGTH)
  .refine(isSafeHref, {
    message: "Links must be site-relative, or a tel: or mailto: address",
  });

const ctaLinkSchema = z
  .object({ label: linkLabelSchema, href: hrefSchema })
  .strip();

/**
 * `contentSlugSchema` is `blogSlugSchema` by another name — one slug shape in
 * the codebase. Kept as a separate binding only so the landing schemas do not
 * read as if they were validating blog posts.
 */
const contentSlugSchema = blogSlugSchema;

const heroSectionSchema = z
  .object({
    kind: z.literal("hero"),
    eyebrow: headingSchema.optional(),
    heading: z
      .string()
      .trim()
      .min(1, "Hero heading is required")
      .max(MAX_HEADING_LENGTH),
    body: bodyTextSchema.optional(),
    primaryCta: ctaLinkSchema.optional(),
    secondaryCta: ctaLinkSchema.optional(),
    phoneCta: z.boolean().optional(),
  })
  .strip();

const richTextSectionSchema = z
  .object({
    kind: z.literal("richText"),
    heading: headingSchema.optional(),
    html: z
      .string()
      .min(1, "Rich text is required")
      .max(MAX_RICH_TEXT_LENGTH)
      // Applied per section rather than to the serialised array, which would
      // false-positive on ordinary JSON punctuation.
      .refine((value) => !hasDangerousHtml(value), {
        message:
          "Rich text contains a script, iframe, inline event handler or scheme URL",
      }),
  })
  .strip();

const featuresSectionSchema = z
  .object({
    kind: z.literal("features"),
    heading: headingSchema.optional(),
    intro: bodyTextSchema.optional(),
    items: z
      .array(
        z
          .object({
            icon: z.string().trim().max(8).optional(),
            title: headingSchema.optional(),
            body: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
          })
          .strip(),
      )
      .min(1)
      .max(MAX_SECTION_ITEMS),
  })
  .strip();

const faqSectionSchema = z
  .object({
    kind: z.literal("faq"),
    heading: headingSchema.optional(),
    items: z
      .array(
        z
          .object({
            question: z.string().trim().min(1).max(MAX_HEADING_LENGTH),
            answer: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
          })
          .strip(),
      )
      .min(1)
      .max(MAX_SECTION_ITEMS),
  })
  .strip();

const ctaSectionSchema = z
  .object({
    kind: z.literal("cta"),
    headline: headingSchema.optional(),
    subtext: bodyTextSchema.optional(),
  })
  .strip();

const linkListSectionSchema = z
  .object({
    kind: z.literal("linkList"),
    heading: headingSchema.optional(),
    items: z.array(ctaLinkSchema).min(1).max(MAX_SECTION_ITEMS),
    footerLink: ctaLinkSchema.optional(),
  })
  .strip();

/** Stores no prices; the renderer reads them from Settings at request time. */
const pricingCardsSectionSchema = z
  .object({
    kind: z.literal("pricingCards"),
    heading: headingSchema.optional(),
    source: z.literal("machines"),
  })
  .strip();

/**
 * `forSlug` tolerates `""` because that is what "Add section" produces before
 * the admin picks an area — the editor must not be able to add a section the
 * API then refuses. An empty slug renders nothing.
 */
const nearbyAreasSectionSchema = z
  .object({
    kind: z.literal("nearbyAreas"),
    heading: headingSchema.optional(),
    forSlug: z.union([z.literal(""), contentSlugSchema]),
    footerLink: ctaLinkSchema.optional(),
  })
  .strip();

const blockRefSectionSchema = z
  .object({
    kind: z.literal("blockRef"),
    blockSlug: z.union([z.literal(""), contentSlugSchema]),
    headingOverride: headingSchema.optional(),
  })
  .strip();

const CONTENT_SECTION_MEMBERS = [
  heroSectionSchema,
  richTextSectionSchema,
  featuresSectionSchema,
  faqSectionSchema,
  ctaSectionSchema,
  linkListSectionSchema,
  pricingCardsSectionSchema,
  nearbyAreasSectionSchema,
] as const;

/**
 * A shared block's contents. `blockRef` is deliberately absent: a block that
 * cannot express a reference cannot participate in a cycle, so resolution
 * needs no depth counter and no visited set.
 */
export const contentSectionSchema = z.discriminatedUnion(
  "kind",
  CONTENT_SECTION_MEMBERS,
);

/** A landing page's contents — the content union plus `blockRef`. */
export const pageSectionSchema = z.discriminatedUnion("kind", [
  ...CONTENT_SECTION_MEMBERS,
  blockRefSectionSchema,
]);

const landingPageFields = {
  path: landingPathSchema,
  title: z.string().trim().min(1, "Title is required").max(MAX_TITLE_LENGTH),
  seoTitle: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  seoDescription: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
  ogImagePath: optionalOrBlank(
    z.string().trim().max(300).refine(isSafeCoverImagePath, {
      message: "OG image must be a site-relative path such as /og-image.jpg",
    }),
  ),
  // Breadcrumb targets are real routes — `/service-area` among them — so they
  // are checked as safe links, not as landing paths, which would reject every
  // reserved ancestor.
  breadcrumbs: z
    .array(z.object({ name: linkLabelSchema, path: hrefSchema }).strip())
    .max(MAX_BREADCRUMBS)
    .optional(),
  sections: z.array(pageSectionSchema).max(MAX_SECTIONS),
  schemaType: z.enum(SCHEMA_TYPES).optional(),
  serviceAreaName: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  status: z.enum(LANDING_STATUSES).optional(),
};

export const landingPageCreateSchema = z.object(landingPageFields).strip();

/**
 * Every field optional, but not *no* fields — an empty PUT would otherwise be
 * a 200 that wrote nothing but a fresh `updatedAt`, which reads in the admin
 * UI as a successful save.
 */
export const landingPageUpdateSchema = z
  .object(landingPageFields)
  .partial()
  .strip()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No editable fields supplied",
  });

const sharedBlockFields = {
  slug: contentSlugSchema,
  name: z.string().trim().min(1, "Name is required").max(MAX_TITLE_LENGTH),
  sections: z.array(contentSectionSchema).min(1).max(MAX_SECTIONS),
  status: z.enum(LANDING_STATUSES).optional(),
};

export const sharedBlockCreateSchema = z.object(sharedBlockFields).strip();

export const sharedBlockUpdateSchema = z
  .object(sharedBlockFields)
  .partial()
  .strip()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No editable fields supplied",
  });

export type LandingPageInput = z.infer<typeof landingPageCreateSchema>;
export type LandingPageUpdateInput = z.infer<typeof landingPageUpdateSchema>;
export type SharedBlockInput = z.infer<typeof sharedBlockCreateSchema>;
export type SharedBlockUpdateInput = z.infer<typeof sharedBlockUpdateSchema>;

/** Collapse a ZodError into a single short, non-leaky message. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Re-exported so server code can keep importing date helpers from here. */
export { spanInDays };
