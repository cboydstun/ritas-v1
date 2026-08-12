import mongoose from "mongoose";
import {
  BLOG_STATUSES,
  MAX_BODY_LENGTH,
  MAX_EXCERPT_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TITLE_LENGTH,
  SLUG_PATTERN,
  type BlogStatus,
} from "@/lib/blog";

const blogPostSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_TITLE_LENGTH,
    },
    excerpt: { type: String, trim: true, maxlength: MAX_EXCERPT_LENGTH },
    // Authored HTML. See `hasDangerousHtml` in src/lib/blog.ts and the note on
    // the public renderer: the security boundary is that only the
    // authenticated admin can write here.
    body: { type: String, required: true, maxlength: MAX_BODY_LENGTH },
    coverImagePath: { type: String, trim: true },
    coverImageAlt: { type: String, trim: true },
    tags: { type: [String], default: [] },
    status: { type: String, enum: BLOG_STATUSES, default: "draft" },
    publishedAt: { type: Date },
    author: { type: String, default: "SATX Ritas" },
    seoTitle: { type: String, trim: true, maxlength: MAX_TITLE_LENGTH },
    seoDescription: { type: String, trim: true, maxlength: MAX_EXCERPT_LENGTH },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "blogposts",
  },
);

// `slug` already gets a unique index from the field definition above; adding a
// second `index({ slug: 1 })` here would create a duplicate and make mongoose
// warn on every boot.
//
// The other two mirror the reasoning in `leaseInquiry.ts`: the public list
// filters on status and sorts by publish date, the admin list sorts by
// recency, and without an index behind either that is an in-memory sort which
// fails outright at Mongo's 32 MB limit once the collection grows.
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ createdAt: -1 });

// Mongoose 9 middleware takes no `next` callback: return to signal completion,
// throw to signal failure. Do not reintroduce `function (next)` — it
// type-errors, and the hook would silently never run.
blogPostSchema.pre("save", function () {
  this.updatedAt = new Date();
});

export const PUBLISHED_WITHOUT_DATE =
  "A published post must have a publishedAt date";

blogPostSchema.pre("save", function () {
  if (this.status === "published" && !this.publishedAt) {
    throw new Error(PUBLISHED_WITHOUT_DATE);
  }
});

/**
 * The plain-Error strings the hooks above throw.
 *
 * These are not mongoose `ValidationError`s, so a route cannot recognise them
 * by type. `blackout-date.ts` exports the same kind of set for the same
 * reason: it is what lets a handler answer 400 instead of 500.
 */
export const MODEL_RULE_MESSAGES = new Set<string>([PUBLISHED_WITHOUT_DATE]);

export const BlogPost =
  mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema);

/**
 * Server-side only. A client component must use the serialised
 * `BlogPostRecord` from `@/lib/blog` instead — importing this type pulls
 * mongoose, and the whole mongodb driver, into the browser bundle.
 */
export type BlogPostDocument = mongoose.Document & {
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  coverImagePath?: string;
  coverImageAlt?: string;
  tags: string[];
  status: BlogStatus;
  publishedAt?: Date;
  author: string;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
};
