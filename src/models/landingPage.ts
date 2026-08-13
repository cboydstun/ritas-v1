import mongoose from "mongoose";
import { MAX_FOCUS_KEYWORD_LENGTH } from "@/lib/blog";
import {
  LANDING_STATUSES,
  MAX_DESCRIPTION_LENGTH,
  MAX_PATH_LENGTH,
  MAX_TITLE_LENGTH,
  SCHEMA_TYPES,
  SECTIONS_NOT_AN_ARRAY,
  SECTION_NOT_AN_OBJECT,
  TOO_MANY_SECTIONS,
  UNKNOWN_SECTION_KIND,
  isLandingPath,
  isReservedPath,
  sectionShapeError,
  type LandingSection,
  type LandingStatus,
  type SchemaType,
} from "@/lib/landing";

export const PUBLISHED_WITHOUT_DATE =
  "A published page must have a publishedAt date";
export const INVALID_PATH =
  "Path must be lowercase slug segments beginning with a slash";
export const RESERVED_PATH = "That path is reserved by an existing route";

const landingPageSchema = new mongoose.Schema(
  {
    /**
     * The public URL, leading slash and all — `/service-area/olmos-park`.
     *
     * Stored as one normalized string rather than a segments array: the
     * catch-all hands us `string[]` and rejoining is free, and a second
     * denormalized field is a second thing to fall out of sync.
     */
    path: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: MAX_PATH_LENGTH,
      // Path validators, not a `pre("save")` hook, so they also fire under
      // `findOneAndUpdate(..., { runValidators: true })` — where hooks do not.
      validate: [
        { validator: isLandingPath, message: INVALID_PATH },
        {
          validator: (value: string) => !isReservedPath(value),
          message: RESERVED_PATH,
        },
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_TITLE_LENGTH,
    },
    seoTitle: { type: String, trim: true, maxlength: MAX_TITLE_LENGTH },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: MAX_DESCRIPTION_LENGTH,
    },
    ogImagePath: { type: String, trim: true },
    // Scored by src/lib/landing-audit.ts. Deliberately unindexed: nothing
    // queries on it, it is only ever read back with the page it belongs to.
    focusKeyword: {
      type: String,
      trim: true,
      maxlength: MAX_FOCUS_KEYWORD_LENGTH,
    },
    /**
     * Explicit rather than derived from the path. Deriving ancestor labels
     * would cost a database read per segment, and the seed can fill these in
     * for free.
     */
    breadcrumbs: {
      type: [{ _id: false, name: String, path: String }],
      default: [],
    },
    // Mixed, so Mongoose neither casts nor deep-validates this. The zod union
    // in `validation.ts` is the only real validation on the path; the hook
    // below is a shallow net. Writers must replace the whole array.
    sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    schemaType: { type: String, enum: SCHEMA_TYPES, default: "WebPage" },
    serviceAreaName: { type: String, trim: true },
    status: { type: String, enum: LANDING_STATUSES, default: "draft" },
    publishedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "landingpages",
  },
);

// `path` already gets a unique index from the field definition; a second
// `index({ path: 1 })` would duplicate it and make mongoose warn on boot.
//
// The compound index serves the public read, which always filters on both.
// The `sections.blockSlug` multikey index backs the shared-block delete guard
// — legal against a Mixed array, because Mixed only removes mongoose's
// casting, not Mongo's indexing.
landingPageSchema.index({ status: 1, path: 1 });
landingPageSchema.index({ createdAt: -1 });
landingPageSchema.index({ "sections.blockSlug": 1 });

// Mongoose 9 middleware takes no `next` callback: return to signal completion,
// throw to signal failure. Do not reintroduce `function (next)` — it
// type-errors, and the hook would silently never run.
landingPageSchema.pre("save", function () {
  this.updatedAt = new Date();
});

landingPageSchema.pre("save", function () {
  if (this.status === "published" && !this.publishedAt) {
    throw new Error(PUBLISHED_WITHOUT_DATE);
  }
  const sectionError = sectionShapeError(this.sections, {
    allowBlockRef: true,
  });
  if (sectionError) {
    throw new Error(sectionError);
  }
});

/**
 * The plain-Error strings the hooks above throw.
 *
 * These are not mongoose `ValidationError`s, so a route cannot recognise them
 * by type. `blackout-date.ts` and `blogPost.ts` export the same kind of set
 * for the same reason: it is what lets a handler answer 400 instead of 500.
 */
export const MODEL_RULE_MESSAGES = new Set<string>([
  PUBLISHED_WITHOUT_DATE,
  SECTIONS_NOT_AN_ARRAY,
  TOO_MANY_SECTIONS,
  SECTION_NOT_AN_OBJECT,
  UNKNOWN_SECTION_KIND,
]);

export const LandingPage =
  mongoose.models.LandingPage ||
  mongoose.model("LandingPage", landingPageSchema);

/**
 * Server-side only. A client component must use the serialised
 * `LandingPageRecord` from `@/lib/landing` instead — importing this type pulls
 * mongoose, and the whole mongodb driver, into the browser bundle.
 */
export type LandingPageDocument = mongoose.Document & {
  path: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImagePath?: string;
  focusKeyword?: string;
  breadcrumbs: { name: string; path: string }[];
  sections: LandingSection[];
  schemaType: SchemaType;
  serviceAreaName?: string;
  status: LandingStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
