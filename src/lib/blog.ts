/**
 * Blog shapes and slug helpers, with no mongoose and no zod import.
 *
 * The same split `src/lib/blackout-dates.ts` makes: the admin form is a client
 * component and needs `slugify` and the record type, and importing those from
 * `src/models/blogPost.ts` would drag mongoose — and the whole mongodb driver
 * — into the browser bundle, which Next 16 fails the build on.
 *
 * Zod-free for the same reason `src/lib/dates.ts` is: the request schemas in
 * `validation.ts` import *from* here, not the other way round.
 */

export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export const MAX_SLUG_LENGTH = 96;
export const MAX_TITLE_LENGTH = 200;
export const MAX_EXCERPT_LENGTH = 300;
export const MAX_BODY_LENGTH = 100_000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;

/**
 * Lowercase words joined by single hyphens. Anchored, and it rejects a
 * leading/trailing hyphen as well as a doubled one, so a slug always
 * round-trips through `slugify` unchanged.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A post as the API serialises it — JSON, not a hydrated mongoose Document.
 * This is what the admin table, the admin form and the public pages consume.
 */
export interface BlogPostRecord {
  _id?: string;
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  coverImagePath?: string;
  coverImageAlt?: string;
  tags?: string[];
  status: BlogStatus;
  publishedAt?: Date | string;
  author?: string;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function isBlogStatus(value: unknown): value is BlogStatus {
  return (
    typeof value === "string" &&
    (BLOG_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Title to URL slug.
 *
 * Decomposes with NFD and strips the combining marks (U+0300–U+036F), so an
 * accented spelling and its plain counterpart produce the same slug rather
 * than the accented letter vanishing entirely. Everything that is not a-z0-9
 * becomes a hyphen, runs collapse, and hyphens are trimmed *after* truncation
 * — truncating first can leave a trailing hyphen, which `SLUG_PATTERN`
 * rejects.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/**
 * Cover images are site-relative only, and this is what keeps that true.
 *
 * A root-relative path needs no `images.remotePatterns` entry in
 * `next.config.ts` and no `img-src` host in the CSP, so the whole blog ships
 * without touching either. Rejects a protocol-relative `//host/x` (which the
 * browser resolves to a remote origin), a backslash — some parsers treat it as
 * a separator — `..` traversal, and any control character.
 */
export function isSafeCoverImagePath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("..")) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}

/**
 * Defense-in-depth on the stored post body — **not a sanitizer.**
 *
 * Post bodies are stored as authored HTML and rendered with
 * `dangerouslySetInnerHTML`, and the CSP carries `script-src 'unsafe-inline'`
 * for the GTM and JSON-LD bootstrap, so a `<script>` in a body would execute.
 * The control that actually matters is that only the authenticated admin can
 * reach `/api/admin/blog` at all; this only makes the obvious mistakes loud.
 *
 * Do not extend this into a general-purpose cleaner, and do not let a caller
 * treat a `false` here as "this HTML is safe". Hand-rolled sanitizers leak. If
 * authoring is ever opened beyond the single admin credential, that is the
 * point at which a real sanitizer goes in.
 */
export function hasDangerousHtml(value: string): boolean {
  return (
    /<\s*(script|iframe|object|embed|base|form)\b/i.test(value) ||
    // `on…=` handlers, anchored inside a tag. An unanchored /\son[a-z]+=/
    // also matched ordinary prose ("switch it on x=1"), which would reject a
    // perfectly good post — a false positive here is a save the admin cannot
    // complete and cannot explain.
    /<[^>]*\son[a-z]+\s*=/i.test(value) ||
    // Scheme-bearing attribute values only, for the same reason: a bare
    // /data:/ matched the word "data:" in a sentence.
    /<[^>]*\b(?:href|src|action|formaction|srcdoc|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:/i.test(
      value,
    )
  );
}
