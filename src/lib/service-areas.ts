/**
 * The neighbourhoods and suburbs the business delivers to.
 *
 * These were hand-listed as inert `<li>` text in `MapSection`, which is
 * exactly the high-intent local vocabulary ("margarita machine rental Stone
 * Oak") the site had no page to rank for. `MapSection` and the
 * `/service-area/[city]` routes now render from this one list, so a new area
 * gets a page and a homepage mention from a single edit.
 */
export interface ServiceArea {
  /** URL segment. */
  slug: string;
  name: string;
  region: "Central" | "North" | "Northwest" | "Northeast";
  /** One line of genuinely area-specific copy for the page and its meta description. */
  blurb: string;
}

export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: "downtown-san-antonio",
    name: "Downtown San Antonio",
    region: "Central",
    blurb:
      "Riverwalk lofts, hotel suites and event spaces — we handle loading docks, service elevators and tight parking windows.",
  },
  {
    slug: "alamo-heights",
    name: "Alamo Heights",
    region: "Central",
    blurb:
      "Backyard parties, graduations and Fiesta gatherings, delivered and set up before your first guest arrives.",
  },
  {
    slug: "olmos-park",
    name: "Olmos Park",
    region: "Central",
    blurb:
      "Quiet streets and narrow driveways. We bring a hand truck and leave the setup tidy.",
  },
  {
    slug: "monte-vista",
    name: "Monte Vista",
    region: "Central",
    blurb:
      "Historic homes with porch-level power. We check your outlet before we leave.",
  },
  {
    slug: "stone-oak",
    name: "Stone Oak",
    region: "North",
    blurb:
      "One of our busiest delivery areas — weekend slots go early, so book ahead for spring and summer parties.",
  },
  {
    slug: "shavano-park",
    name: "Shavano Park",
    region: "North",
    blurb:
      "Gated-community deliveries welcome; give us the gate code when you book and we will handle the rest.",
  },
  {
    slug: "hollywood-park",
    name: "Hollywood Park",
    region: "North",
    blurb:
      "Family block parties and neighbourhood events, with enough capacity for 40 to 120 guests.",
  },
  {
    slug: "castle-hills",
    name: "Castle Hills",
    region: "North",
    blurb:
      "Quick runs from our North Side base — same-day availability is often possible midweek.",
  },
  {
    slug: "leon-valley",
    name: "Leon Valley",
    region: "Northwest",
    blurb:
      "Community centres, church halls and backyard quinceañeras, delivered with everything you need but the ice.",
  },
  {
    slug: "helotes",
    name: "Helotes",
    region: "Northwest",
    blurb:
      "Hill Country events and ranch venues on the far Northwest side, well inside our delivery radius.",
  },
  {
    slug: "the-dominion",
    name: "The Dominion",
    region: "Northwest",
    blurb:
      "Discreet delivery and pickup for private events, with setup completed ahead of your start time.",
  },
  {
    slug: "la-cantera",
    name: "La Cantera",
    region: "Northwest",
    blurb:
      "Resort-area corporate events and receptions — we coordinate directly with venue staff.",
  },
  {
    slug: "schertz",
    name: "Schertz",
    region: "Northeast",
    blurb:
      "Northeast suburbs are a standard delivery area, no extra travel charge inside 30 miles of downtown.",
  },
  {
    slug: "universal-city",
    name: "Universal City",
    region: "Northeast",
    blurb:
      "Retirements, PCS send-offs and unit gatherings near Randolph, set up and collected on your schedule.",
  },
  {
    slug: "converse",
    name: "Converse",
    region: "Northeast",
    blurb:
      "Backyard birthdays and church events, with triple-tank machines for larger crowds.",
  },
  {
    slug: "live-oak",
    name: "Live Oak",
    region: "Northeast",
    blurb:
      "A short run up 35 — weekday deliveries are usually available at short notice.",
  },
];

export const SERVICE_AREA_REGIONS = [
  "Central",
  "North",
  "Northwest",
  "Northeast",
] as const;

export function getServiceArea(slug: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((area) => area.slug === slug);
}

export function serviceAreasByRegion(
  region: ServiceArea["region"],
): ServiceArea[] {
  return SERVICE_AREAS.filter((area) => area.region === region);
}

/**
 * The "we also deliver nearby" mesh for one area: every other area in the same
 * region, plus two deterministic picks from other regions.
 *
 * Filtering to the same region alone split the 16 pages into four
 * disconnected islands with no path between them. The cross-region picks are
 * index-based rather than random so the markup stays stable across builds.
 *
 * Extracted from `/service-area/[city]/page.tsx` so the landing-page renderer
 * and the seed share one implementation. The dedupe is new: with only one
 * other region, `[0, 1]` selected the same area twice, which is a duplicate
 * React key and a repeated chip. Unreachable with 16 areas across 4 regions,
 * reachable the moment someone prunes the list.
 */
export function nearbyServiceAreas(slug: string): ServiceArea[] {
  const area = getServiceArea(slug);
  if (!area) return [];

  const sameRegion = SERVICE_AREAS.filter(
    (other) => other.region === area.region && other.slug !== area.slug,
  );
  const otherRegions = SERVICE_AREAS.filter(
    (other) => other.region !== area.region,
  );
  const offset = SERVICE_AREAS.findIndex((other) => other.slug === area.slug);
  const crossRegion = otherRegions.length
    ? [0, 1].map((i) => otherRegions[(offset + i) % otherRegions.length])
    : [];

  const seen = new Set<string>();
  return [...sameRegion, ...crossRegion].filter((other) => {
    if (seen.has(other.slug)) return false;
    seen.add(other.slug);
    return true;
  });
}
