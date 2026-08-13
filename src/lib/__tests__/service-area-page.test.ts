/**
 * @jest-environment node
 *
 * The seed documents for the 16 service-area pages.
 *
 * The load-bearing assertion is that every one of them parses under the real
 * `landingPageCreateSchema`. `sections` is a Mixed path, so zod is the only
 * thing that validates it — a seed that drifted from the schema would write a
 * shape no route would ever accept, and nothing else would notice.
 */

import {
  DELIVERY_INCLUDES,
  SERVICE_AREA_SEED,
  serviceAreaFallbackPage,
  serviceAreaPageDoc,
  serviceAreaSections,
} from "@/lib/service-area-page";
import { SERVICE_AREAS, getServiceArea } from "@/lib/service-areas";
import { landingPageCreateSchema } from "@/lib/validation";
import type { FeaturesSection, HeroSection } from "@/lib/landing";

describe("SERVICE_AREA_SEED", () => {
  it("covers every service area exactly once", () => {
    expect(SERVICE_AREA_SEED).toHaveLength(SERVICE_AREAS.length);
    expect(new Set(SERVICE_AREA_SEED.map((doc) => doc.path)).size).toBe(
      SERVICE_AREAS.length,
    );
  });

  it.each(SERVICE_AREA_SEED.map((doc) => [doc.path, doc] as const))(
    "%s parses under the create schema",
    (_path, doc) => {
      const result = landingPageCreateSchema.safeParse(doc);

      expect(result.error?.issues[0]).toBeUndefined();
      expect(result.success).toBe(true);
    },
  );

  it("publishes each page at its current live URL", () => {
    expect(SERVICE_AREA_SEED.map((doc) => doc.path)).toContain(
      "/service-area/olmos-park",
    );
    expect(SERVICE_AREA_SEED.every((doc) => doc.status === "published")).toBe(
      true,
    );
  });

  // Moving either would move what Google already has indexed.
  it("keeps the indexed title and description verbatim", () => {
    const doc = serviceAreaPageDoc(getServiceArea("stone-oak")!);

    expect(doc.seoTitle).toBe(
      "Margarita Machine Rental in Stone Oak | SATX Ritas",
    );
    expect(doc.seoDescription).toMatch(
      /^Frozen drink and margarita machine rental delivered to Stone Oak, San Antonio\. /,
    );
  });

  it("declares itself a Service with the area it serves", () => {
    const doc = serviceAreaPageDoc(getServiceArea("helotes")!);

    expect(doc.schemaType).toBe("Service");
    expect(doc.serviceAreaName).toBe("Helotes, San Antonio, TX");
  });

  it("carries a breadcrumb trail through the hub", () => {
    const doc = serviceAreaPageDoc(getServiceArea("converse")!);

    expect(doc.breadcrumbs).toEqual([
      { name: "Service Areas", path: "/service-area" },
      { name: "Converse", path: "/service-area/converse" },
    ]);
  });
});

describe("serviceAreaSections", () => {
  const sections = serviceAreaSections(getServiceArea("olmos-park")!);

  it("matches the order the hand-written page rendered", () => {
    expect(sections.map((section) => section.kind)).toEqual([
      "hero",
      "pricingCards",
      "features",
      "nearbyAreas",
      "cta",
    ]);
  });

  it("keeps the area's own copy in the hero", () => {
    const hero = sections[0] as HeroSection;

    expect(hero.eyebrow).toBe("Central San Antonio");
    expect(hero.heading).toBe("Margarita Machine Rental in Olmos Park");
    expect(hero.body).toMatch(/^Quiet streets and narrow driveways\./);
    expect(hero.body).toMatch(/a power outlet and the ice\.$/);
    expect(hero.primaryCta).toEqual({
      label: "Check availability for your date",
      href: "/order",
    });
    // The number is resolved from site.ts at render, never stored.
    expect(hero.phoneCta).toBe(true);
  });

  // Storing either would freeze it: prices would stop tracking Settings, and
  // the link mesh would stop noticing a newly added area.
  it("stores no prices and no nearby links", () => {
    expect(sections[1]).toEqual({
      kind: "pricingCards",
      heading: "Machines available in Olmos Park",
      source: "machines",
    });
    expect(sections[3]).toMatchObject({
      kind: "nearbyAreas",
      forSlug: "olmos-park",
    });
    expect(sections[3]).not.toHaveProperty("items");
  });

  it("carries the four delivery bullets", () => {
    const features = sections[2] as FeaturesSection;

    expect(features.heading).toBe("What delivery to Olmos Park includes");
    expect(features.items).toHaveLength(4);
    expect(features.items.map((item) => item.body)).toEqual(
      DELIVERY_INCLUDES.items.map((item) => item.body),
    );
  });

  it("does not mutate the shared delivery block when it adds a heading", () => {
    expect(DELIVERY_INCLUDES).not.toHaveProperty("heading");
  });
});

/**
 * The outage path. One function seeds and one function falls back, and they
 * are the same function — so the fallback cannot drift from what was written.
 */
describe("serviceAreaFallbackPage", () => {
  it("rebuilds a known area's page", () => {
    const page = serviceAreaFallbackPage("/service-area/schertz");

    expect(page?.title).toBe("Margarita Machine Rental in Schertz");
    expect(page?.sections).toEqual(
      serviceAreaSections(getServiceArea("schertz")!),
    );
  });

  it.each([
    ["an unknown area", "/service-area/atlantis"],
    ["a path outside the hub", "/weddings"],
    ["the hub itself", "/service-area"],
    ["a deeper path", "/service-area/schertz/extra"],
  ])("returns null for %s", (_label, path) => {
    expect(serviceAreaFallbackPage(path)).toBeNull();
  });
});
