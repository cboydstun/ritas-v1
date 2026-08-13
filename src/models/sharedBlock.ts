import mongoose from "mongoose";
import { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH, SLUG_PATTERN } from "@/lib/blog";
import {
  LANDING_STATUSES,
  SECTIONS_NOT_AN_ARRAY,
  SECTION_NOT_AN_OBJECT,
  TOO_MANY_SECTIONS,
  UNKNOWN_SECTION_KIND,
  sectionShapeError,
  type ContentSection,
  type LandingStatus,
} from "@/lib/landing";

/**
 * A reusable fragment of one or more content sections, inserted into a landing
 * page by `{ kind: "blockRef", blockSlug }` and edited in one place.
 *
 * A block holds **content** sections only — `blockRef` is not in the union it
 * validates against. That makes a reference cycle impossible to express rather
 * than merely depth-limited, so resolution needs no visited set and no counter.
 */
const sharedBlockSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: MAX_SLUG_LENGTH,
      match: [
        SLUG_PATTERN,
        "Slug must be lowercase words separated by hyphens",
      ],
    },
    /** What the admin sees in the section picker, not part of any URL. */
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_TITLE_LENGTH,
    },
    // Mixed — see the note on `landingPage.ts`. Zod is the real validation.
    sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    status: { type: String, enum: LANDING_STATUSES, default: "draft" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "sharedblocks",
  },
);

// `slug` already carries a unique index from its field definition.
sharedBlockSchema.index({ status: 1, slug: 1 });
sharedBlockSchema.index({ createdAt: -1 });

sharedBlockSchema.pre("save", function () {
  this.updatedAt = new Date();
});

sharedBlockSchema.pre("save", function () {
  const sectionError = sectionShapeError(this.sections, {
    allowBlockRef: false,
  });
  if (sectionError) {
    throw new Error(sectionError);
  }
});

export const MODEL_RULE_MESSAGES = new Set<string>([
  SECTIONS_NOT_AN_ARRAY,
  TOO_MANY_SECTIONS,
  SECTION_NOT_AN_OBJECT,
  UNKNOWN_SECTION_KIND,
]);

export const SharedBlock =
  mongoose.models.SharedBlock ||
  mongoose.model("SharedBlock", sharedBlockSchema);

/**
 * Server-side only. Client components use `SharedBlockRecord` from
 * `@/lib/landing`.
 */
export type SharedBlockDocument = mongoose.Document & {
  slug: string;
  name: string;
  sections: ContentSection[];
  status: LandingStatus;
  createdAt: Date;
  updatedAt: Date;
};
