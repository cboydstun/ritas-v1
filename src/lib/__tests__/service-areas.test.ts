import {
  SERVICE_AREAS,
  SERVICE_AREA_REGIONS,
  getServiceArea,
  nearbyServiceAreas,
  serviceAreasByRegion,
} from "@/lib/service-areas";

describe("service areas", () => {
  it("has a unique slug per area", () => {
    const slugs = SERVICE_AREAS.map((a) => a.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // The slug is the URL segment, so anything else would produce a page whose
  // canonical does not match its own path.
  it("uses URL-safe slugs", () => {
    for (const area of SERVICE_AREAS) {
      expect(area.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("gives every area a region the map section renders", () => {
    for (const area of SERVICE_AREAS) {
      expect(SERVICE_AREA_REGIONS).toContain(area.region);
    }
  });

  // The blurb is both page copy and the meta description; an empty one would
  // ship a page with nothing area-specific on it.
  it("gives every area a non-empty blurb", () => {
    for (const area of SERVICE_AREAS) {
      expect(area.blurb.trim().length).toBeGreaterThan(20);
    }
  });

  it("covers every region with at least one area", () => {
    for (const region of SERVICE_AREA_REGIONS) {
      expect(serviceAreasByRegion(region).length).toBeGreaterThan(0);
    }
  });

  it("looks an area up by slug and reports an unknown one", () => {
    expect(getServiceArea("stone-oak")?.name).toBe("Stone Oak");
    expect(getServiceArea("not-a-place")).toBeUndefined();
  });
});

/**
 * The internal-link mesh. Extracted from `/service-area/[city]/page.tsx` so
 * the landing-page renderer and the seed compute the identical set.
 */
describe("nearbyServiceAreas", () => {
  it("returns every other area in the same region, plus cross-region picks", () => {
    const nearby = nearbyServiceAreas("stone-oak");
    const sameRegion = nearby.filter((area) => area.region === "North");
    const crossRegion = nearby.filter((area) => area.region !== "North");

    expect(sameRegion.map((a) => a.slug).sort()).toEqual(
      ["castle-hills", "hollywood-park", "shavano-park"].sort(),
    );
    expect(crossRegion).toHaveLength(2);
  });

  it("never includes the area itself", () => {
    for (const area of SERVICE_AREAS) {
      const slugs = nearbyServiceAreas(area.slug).map((other) => other.slug);

      expect(slugs).not.toContain(area.slug);
    }
  });

  // Index-based rather than random, so prerendered markup is stable across
  // builds and two renders of the same page never differ.
  it("is deterministic", () => {
    expect(nearbyServiceAreas("helotes")).toEqual(
      nearbyServiceAreas("helotes"),
    );
  });

  it("never repeats an area", () => {
    for (const area of SERVICE_AREAS) {
      const slugs = nearbyServiceAreas(area.slug).map((other) => other.slug);

      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("gives every area a link out of its own region", () => {
    for (const area of SERVICE_AREAS) {
      const nearby = nearbyServiceAreas(area.slug);

      expect(nearby.some((other) => other.region !== area.region)).toBe(true);
    }
  });

  it("returns nothing for an unknown slug", () => {
    expect(nearbyServiceAreas("not-a-place")).toEqual([]);
  });
});
