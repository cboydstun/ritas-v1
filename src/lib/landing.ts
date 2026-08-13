/**
 * Landing-page shapes, path helpers and section resolution, with no mongoose
 * and no zod import.
 *
 * The same split `src/lib/blog.ts` makes, for the same two reasons: the admin
 * section editor is a client component and needs the section types and the
 * `defaultSection` factory, and importing those from `src/models/landingPage.ts`
 * would drag mongoose — and the whole mongodb driver — into the browser
 * bundle. Zod-free because the request schemas in `validation.ts` import
 * *from* here, never the other way round.
 *
 * `SLUG_PATTERN` and `slugify` are reused from `@/lib/blog` rather than
 * redeclared. One slug regex in the codebase, no drift.
 */

import { SLUG_PATTERN, slugify } from "@/lib/blog";

export const LANDING_STATUSES = ["draft", "published"] as const;
export type LandingStatus = (typeof LANDING_STATUSES)[number];

/**
 * `none` suppresses the page-type node entirely, for a page that should not
 * declare itself as anything (a thank-you page, an internal lander).
 */
export const SCHEMA_TYPES = ["WebPage", "Service", "FAQPage", "none"] as const;
export type SchemaType = (typeof SCHEMA_TYPES)[number];

/**
 * Sections that carry their own content. A shared block is an array of these
 * — deliberately excluding `blockRef`, which is what makes a reference cycle
 * impossible to express rather than merely depth-limited.
 */
export const CONTENT_SECTION_KINDS = [
  "hero",
  "richText",
  "features",
  "faq",
  "cta",
  "linkList",
  "pricingCards",
  "nearbyAreas",
] as const;
export type ContentSectionKind = (typeof CONTENT_SECTION_KINDS)[number];

export const SECTION_KINDS = [...CONTENT_SECTION_KINDS, "blockRef"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const MAX_PATH_SEGMENTS = 4;
export const MAX_PATH_LENGTH = 200;
export const MAX_SECTIONS = 40;
export const MAX_SECTION_ITEMS = 20;
export const MAX_RICH_TEXT_LENGTH = 20_000;
export const MAX_HEADING_LENGTH = 200;
export const MAX_TEXT_LENGTH = 2_000;
export const MAX_LABEL_LENGTH = 120;
export const MAX_HREF_LENGTH = 300;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 300;
export const MAX_BREADCRUMBS = 4;

/**
 * Body cap for the landing-page and shared-block admin writes, overriding the
 * 64 KB default in `guardAdminWrite`. A sections array carrying authored HTML
 * legitimately runs to tens of kilobytes; the blog routes raise the cap to the
 * same figure for the same reason.
 */
export const LANDING_BODY_LIMIT = 256 * 1024;

export interface CtaLink {
  label: string;
  href: string;
}

export interface HeroSection {
  kind: "hero";
  eyebrow?: string;
  heading: string;
  body?: string;
  primaryCta?: CtaLink;
  secondaryCta?: CtaLink;
  /** Renders the business phone from `site.ts`. The number is never stored. */
  phoneCta?: boolean;
}

export interface RichTextSection {
  kind: "richText";
  heading?: string;
  /** Authored HTML. See `hasDangerousHtml` — a guard, not a sanitizer. */
  html: string;
}

export interface FeatureItem {
  icon?: string;
  title?: string;
  body: string;
}

export interface FeaturesSection {
  kind: "features";
  heading?: string;
  intro?: string;
  items: FeatureItem[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection {
  kind: "faq";
  heading?: string;
  items: FaqItem[];
}

export interface CtaSection {
  kind: "cta";
  headline?: string;
  subtext?: string;
}

export interface LinkListSection {
  kind: "linkList";
  heading?: string;
  items: CtaLink[];
  footerLink?: CtaLink;
}

/**
 * Stores no prices. The renderer resolves them from `Settings` through
 * `publicPriceTable()`, so an admin price change flows into every page that
 * carries this section. Flattening the grid into stored content would freeze
 * prices into the database — the `/long-term-lease` bug, one layer deeper.
 */
export interface PricingCardsSection {
  kind: "pricingCards";
  heading?: string;
  source: "machines";
}

/**
 * Stores no links. `forSlug` names the area the mesh is computed *around*, so
 * adding a 17th service area updates the other 16 without touching a document.
 */
export interface NearbyAreasSection {
  kind: "nearbyAreas";
  heading?: string;
  forSlug: string;
  footerLink?: CtaLink;
}

export interface BlockRefSection {
  kind: "blockRef";
  blockSlug: string;
  /** Applies to the first resolved section, and only if it has a heading. */
  headingOverride?: string;
}

export type ContentSection =
  | HeroSection
  | RichTextSection
  | FeaturesSection
  | FaqSection
  | CtaSection
  | LinkListSection
  | PricingCardsSection
  | NearbyAreasSection;

export type LandingSection = ContentSection | BlockRefSection;

export interface Breadcrumb {
  name: string;
  path: string;
}

/**
 * A landing page as the API serialises it — JSON, not a hydrated mongoose
 * Document. What the admin table, the admin form and the public pages consume.
 */
export interface LandingPageRecord {
  _id?: string;
  path: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImagePath?: string;
  breadcrumbs?: Breadcrumb[];
  sections: LandingSection[];
  schemaType: SchemaType;
  /** `areaServed` for the `Service` node, e.g. "Olmos Park, San Antonio, TX". */
  serviceAreaName?: string;
  status: LandingStatus;
  publishedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SharedBlockRecord {
  _id?: string;
  slug: string;
  name: string;
  sections: ContentSection[];
  status: LandingStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function isLandingStatus(value: unknown): value is LandingStatus {
  return (
    typeof value === "string" &&
    (LANDING_STATUSES as readonly string[]).includes(value)
  );
}

export function isSectionKind(value: unknown): value is SectionKind {
  return (
    typeof value === "string" &&
    (SECTION_KINDS as readonly string[]).includes(value)
  );
}

export function isContentSectionKind(
  value: unknown,
): value is ContentSectionKind {
  return (
    typeof value === "string" &&
    (CONTENT_SECTION_KINDS as readonly string[]).includes(value)
  );
}

/**
 * A storable landing path: leading slash, lowercase, no trailing slash, and
 * every segment a valid slug.
 *
 * Checked structurally rather than with one large regex, because reusing
 * `SLUG_PATTERN` per segment buys a pile of rejections for free: no uppercase,
 * no `//`, no `..` traversal, and — the useful one — **no dots at all**, so
 * `/og-image.jpg` can never be a landing path and the `public/` files need no
 * reserved-list entry. A decoded `%2F` also fails, because a literal slash
 * inside a segment is not a slug.
 *
 * The segment cap bounds ISR cache fan-out under crawler noise.
 */
export function isLandingPath(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!value.startsWith("/")) return false;
  if (value.length > MAX_PATH_LENGTH) return false;
  const segments = value.slice(1).split("/");
  if (segments.length === 0 || segments.length > MAX_PATH_SEGMENTS) {
    return false;
  }
  return segments.every((segment) => SLUG_PATTERN.test(segment));
}

/** The catch-all hands us `string[]`. Returns null rather than throwing. */
export function landingPathFromSegments(segments: string[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const path = "/" + segments.join("/");
  return isLandingPath(path) ? path : null;
}

export function landingPathToSegments(path: string): string[] {
  return path.replace(/^\//, "").split("/");
}

/**
 * Free text to a landing path — `slugify` per segment, so the admin form can
 * auto-fill a path from a title the way `BlogPostForm` auto-fills a slug.
 */
export function pathify(value: string): string {
  const segments = value
    .split("/")
    .map((segment) => slugify(segment))
    .filter(Boolean)
    .slice(0, MAX_PATH_SEGMENTS);
  return segments.length ? "/" + segments.join("/") : "";
}

/**
 * Paths that are real routes today. A landing page at one of these would save
 * and then never render, because Next always prefers a static or `[param]`
 * route over the root catch-all.
 *
 * `src/lib/__tests__/reserved-paths.test.ts` walks `src/app/` and fails if a
 * route exists that is not covered here. That test, not this list, is what
 * keeps this honest when someone adds a route in six months.
 */
export const RESERVED_EXACT = new Set([
  "/",
  "/about",
  "/admin",
  "/blog",
  "/contact",
  "/faq",
  "/long-term-lease",
  "/order",
  "/pricing",
  "/service-area",
  "/success",
]);

/**
 * First segments the app owns outright, children included.
 *
 * `service-area` is deliberately absent: it is exact-reserved above (the hub
 * owns `/service-area` and wins precedence anyway), but everything below it is
 * exactly where the 16 seeded city pages live.
 */
export const RESERVED_PREFIXES = [
  "_next",
  "admin",
  "api",
  "blog",
  "favicon",
  "order",
  "success",
];

export function isReservedPath(path: string): boolean {
  if (RESERVED_EXACT.has(path)) return true;
  const first = path.replace(/^\//, "").split("/")[0];
  return RESERVED_PREFIXES.includes(first);
}

/**
 * Site-relative paths plus `tel:`/`mailto:`. Rejects a protocol-relative
 * `//host/x`, which the browser resolves to a remote origin, and every
 * script-bearing scheme.
 */
export function isSafeHref(value: string): boolean {
  if (value.length > MAX_HREF_LENGTH) return false;
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return false;
  if (value.startsWith("tel:") || value.startsWith("mailto:")) {
    return value.includes(":") && value.split(":")[1].length > 0;
  }
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("..")) return false;
  return true;
}

/** Every distinct block slug a section list references, in first-seen order. */
export function blockSlugsIn(sections: LandingSection[]): string[] {
  const seen = new Set<string>();
  for (const section of sections) {
    // An unset slug is what "Add section" produces before the admin picks a
    // block. Skipping it keeps the `$in` query and the resolve map clean.
    if (
      section.kind === "blockRef" &&
      section.blockSlug &&
      !seen.has(section.blockSlug)
    ) {
      seen.add(section.blockSlug);
    }
  }
  return [...seen];
}

/**
 * Flatten `blockRef`s into the content sections they point at.
 *
 * A ref whose block is missing — deleted, or a draft filtered out by the
 * caller's query — resolves to **nothing**. Not a throw, not a 404: a missing
 * fragment must never take down a page that is otherwise fine. The admin
 * preview passes drafts in and flags them instead.
 */
export function resolveSections(
  sections: LandingSection[],
  blocksBySlug: Map<string, ContentSection[]>,
): ContentSection[] {
  const resolved: ContentSection[] = [];

  for (const section of sections) {
    if (section.kind !== "blockRef") {
      resolved.push(section);
      continue;
    }

    const blockSections = blocksBySlug.get(section.blockSlug);
    if (!blockSections || blockSections.length === 0) continue;

    blockSections.forEach((blockSection, index) => {
      // The one templating affordance. Deliberately not token substitution:
      // escaping `{{name}}` across authored HTML has no good answer.
      if (index === 0 && section.headingOverride && "heading" in blockSection) {
        resolved.push({ ...blockSection, heading: section.headingOverride });
        return;
      }
      resolved.push(blockSection);
    });
  }

  return resolved;
}

/**
 * The shape "Add section" appends. Every one of these must parse under
 * `pageSectionSchema`, which `landing.test.ts` asserts for each kind — an
 * editor that can add a section the API then rejects is unusable.
 */
export function defaultSection(kind: SectionKind): LandingSection {
  switch (kind) {
    case "hero":
      return { kind: "hero", heading: "New heading" };
    case "richText":
      return { kind: "richText", html: "<p>New paragraph.</p>" };
    case "features":
      return { kind: "features", items: [{ body: "New item" }] };
    case "faq":
      return {
        kind: "faq",
        items: [{ question: "New question?", answer: "New answer." }],
      };
    case "cta":
      return { kind: "cta" };
    case "linkList":
      return { kind: "linkList", items: [{ label: "New link", href: "/" }] };
    case "pricingCards":
      return { kind: "pricingCards", source: "machines" };
    case "nearbyAreas":
      return { kind: "nearbyAreas", forSlug: "" };
    case "blockRef":
      return { kind: "blockRef", blockSlug: "" };
  }
}

/** Human label for the section-kind picker and the collapsed row summary. */
export const SECTION_LABELS: Record<SectionKind, string> = {
  hero: "Hero",
  richText: "Rich text",
  features: "Feature list",
  faq: "FAQ",
  cta: "Booking CTA",
  linkList: "Link list",
  pricingCards: "Machine pricing cards",
  nearbyAreas: "Nearby service areas",
  blockRef: "Shared block",
};

/**
 * A coarse shape check for a stored `sections` array.
 *
 * The zod union in `validation.ts` is the real validation — `sections` is a
 * `Mixed` path, so Mongoose neither casts nor deep-validates it, and
 * `runValidators` on a query update runs path validators only. This is the net
 * under the model's `pre("save")` hook that catches anything which reached the
 * document without going through a route, and it is deliberately shallow: it
 * asserts structure, never field contents.
 *
 * Returns the message to throw, or null when the array is acceptable.
 */
export function sectionShapeError(
  value: unknown,
  options: { allowBlockRef: boolean },
): string | null {
  if (!Array.isArray(value)) return SECTIONS_NOT_AN_ARRAY;
  if (value.length > MAX_SECTIONS) return TOO_MANY_SECTIONS;

  for (const section of value) {
    if (!section || typeof section !== "object" || Array.isArray(section)) {
      return SECTION_NOT_AN_OBJECT;
    }
    const kind = (section as { kind?: unknown }).kind;
    const known = options.allowBlockRef
      ? isSectionKind(kind)
      : isContentSectionKind(kind);
    if (!known) return UNKNOWN_SECTION_KIND;
  }

  return null;
}

export const SECTIONS_NOT_AN_ARRAY = "Sections must be an array";
export const TOO_MANY_SECTIONS = `A page cannot have more than ${MAX_SECTIONS} sections`;
export const SECTION_NOT_AN_OBJECT = "Each section must be an object";
export const UNKNOWN_SECTION_KIND = "Each section must have a known kind";
