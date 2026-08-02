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
