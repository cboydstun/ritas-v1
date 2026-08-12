import {
  SERVICE_AREAS,
  SERVICE_AREA_REGIONS,
  getServiceArea,
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
