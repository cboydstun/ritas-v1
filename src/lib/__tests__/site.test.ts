import { breadcrumbJsonLd, SITE_URL } from "@/lib/site";

describe("breadcrumbJsonLd", () => {
  it("always roots the trail at the production home URL", () => {
    const crumbs = breadcrumbJsonLd([{ name: "Pricing", path: "/pricing" }]);
    const items = crumbs.itemListElement as Record<string, unknown>[];

    expect(items[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    });
  });

  // A preview or local build must still describe the production URLs, for the
  // same reason the sitemap and the JSON-LD @ids do.
  it("emits absolute production URLs and 1-based positions", () => {
    const crumbs = breadcrumbJsonLd([
      { name: "Service Areas", path: "/service-area" },
      { name: "Alamo Heights", path: "/service-area/alamo-heights" },
    ]);
    const items = crumbs.itemListElement as Record<string, unknown>[];

    expect(items).toHaveLength(3);
    expect(items[1].position).toBe(2);
    expect(items[2].item).toBe(`${SITE_URL}/service-area/alamo-heights`);
    for (const item of items) {
      expect(String(item.item).startsWith("https://")).toBe(true);
    }
  });

  it("is a well-formed BreadcrumbList", () => {
    const crumbs = breadcrumbJsonLd([{ name: "FAQ", path: "/faq" }]);

    expect(crumbs["@context"]).toBe("https://schema.org");
    expect(crumbs["@type"]).toBe("BreadcrumbList");
  });
});
