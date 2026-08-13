import {
  SERVICE_AREAS,
  getServiceArea,
  type ServiceArea,
} from "@/lib/service-areas";
import type {
  FeaturesSection,
  LandingPageRecord,
  LandingSection,
} from "@/lib/landing";

/**
 * The 16 `/service-area/[city]` pages, expressed as landing-page documents.
 *
 * One function with two callers, and that is the point: the seeder writes what
 * this returns, and the database-outage fallback renders what this returns. It
 * is structurally impossible for the fallback to drift from what was seeded.
 *
 * The parts the hand-written page computed at render time stay computed —
 * machine prices resolve from `Settings`, the nearby-areas mesh resolves from
 * `SERVICE_AREAS`, and the `Service` node is rebuilt from `schemaType`. None
 * of it is flattened into stored content, so an admin price change still
 * reaches all 16 pages and a 17th area still joins the mesh on the other 16.
 */

/** The four bullets, byte-identical across all 16 pages. */
export const DELIVERY_INCLUDES: FeaturesSection = {
  kind: "features",
  items: [
    {
      icon: "🚚",
      body: "Delivery and pickup — a flat fee, no per-mile charge.",
    },
    {
      icon: "🔧",
      body: "Setup and a walkthrough of the controls before we leave.",
    },
    { icon: "🧼", body: "Cleaning after the event; you never rinse a tank." },
    {
      icon: "🍹",
      body: "Mixer concentrate for each tank, or bring your own — Texas law prevents us from supplying alcohol.",
    },
  ],
};

export function serviceAreaPath(slug: string): string {
  return `/service-area/${slug}`;
}

export function serviceAreaSections(area: ServiceArea): LandingSection[] {
  return [
    {
      kind: "hero",
      eyebrow: `${area.region} San Antonio`,
      heading: `Margarita Machine Rental in ${area.name}`,
      body: `${area.blurb} We deliver, set up and collect the machine, so all you provide is a power outlet and the ice.`,
      primaryCta: {
        label: "Check availability for your date",
        href: "/order",
      },
      phoneCta: true,
    },
    {
      kind: "pricingCards",
      heading: `Machines available in ${area.name}`,
      source: "machines",
    },
    {
      ...DELIVERY_INCLUDES,
      heading: `What delivery to ${area.name} includes`,
    },
    {
      kind: "nearbyAreas",
      heading: "We also deliver nearby",
      forSlug: area.slug,
      footerLink: {
        label: "See every area we deliver to",
        href: "/service-area",
      },
    },
    { kind: "cta" },
  ];
}

/**
 * The document the seeder upserts. The SEO title and description are copied
 * verbatim from the hand-written `generateMetadata`, so the indexed title and
 * description do not move when the page changes hands.
 */
export function serviceAreaPageDoc(area: ServiceArea) {
  return {
    path: serviceAreaPath(area.slug),
    title: `Margarita Machine Rental in ${area.name}`,
    seoTitle: `Margarita Machine Rental in ${area.name} | SATX Ritas`,
    seoDescription: `Frozen drink and margarita machine rental delivered to ${area.name}, San Antonio. ${area.blurb}`,
    breadcrumbs: [
      { name: "Service Areas", path: "/service-area" },
      { name: area.name, path: serviceAreaPath(area.slug) },
    ],
    sections: serviceAreaSections(area),
    schemaType: "Service" as const,
    serviceAreaName: `${area.name}, San Antonio, TX`,
    status: "published" as const,
  };
}

export const SERVICE_AREA_SEED = SERVICE_AREAS.map(serviceAreaPageDoc);

/**
 * What to render for a service-area path when the database read **threw**.
 *
 * Only on a throw. A `null` from a successful query means "not published", and
 * resurrecting the page from the constant would make it impossible for an
 * admin to ever take one down — a worse bug than the 404 it would be papering
 * over.
 *
 * Returns null for any path that is not a known area, so every other landing
 * path still degrades to a clean 404 during an outage.
 */
export function serviceAreaFallbackPage(
  path: string,
): LandingPageRecord | null {
  const slug = path.startsWith("/service-area/")
    ? path.slice("/service-area/".length)
    : null;
  if (!slug || slug.includes("/")) return null;

  const area = getServiceArea(slug);
  if (!area) return null;

  const now = new Date();
  return {
    ...serviceAreaPageDoc(area),
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
