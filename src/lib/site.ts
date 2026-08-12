/**
 * Canonical production origin for the public site.
 *
 * Used by `app/robots.ts`, `app/sitemap.ts`, and JSON-LD structured data — all
 * of which must always emit the production domain, even when generated from a
 * preview or local build. Page-level canonical URLs resolve against
 * `metadataBase` in `app/layout.tsx` instead, which is environment-aware.
 */
/**
 * Must be the host that actually serves pages: the apex `satxritas.com`
 * issues a 308 to `www`, so emitting the apex in canonicals, the sitemap and
 * JSON-LD `@id`s pointed every machine-readable reference at a redirect.
 */
export const SITE_URL = "https://www.satxritas.com";

/** Stable schema.org `@id` for the LocalBusiness node shared across pages. */
export const BUSINESS_ID = `${SITE_URL}/#business`;

/**
 * The one phone number the business publishes, in the two forms pages need.
 *
 * Kept here because it appears in navigation, the footer, three pages and the
 * JSON-LD, and a number that disagrees with itself across those is worse than
 * one that is merely hard to change.
 */
export const BUSINESS_PHONE_E164 = "+15122100194";
export const BUSINESS_PHONE_DISPLAY = "(512) 210-0194";
export const BUSINESS_PHONE_HREF = `tel:${BUSINESS_PHONE_E164}`;

/**
 * Where to send a customer who wants to leave a Google review.
 *
 * There is no derivable URL for a Google Business profile — it carries an
 * opaque place id — so the review CTA on /success renders only when this is
 * configured. A broken review link is worse than no review link.
 */
export const GOOGLE_REVIEW_URL =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ?? "";
