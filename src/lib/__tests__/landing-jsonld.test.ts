/**
 * @jest-environment node
 *
 * The JSON-LD is the part of a landing page Google reads, and the part with no
 * visual regression to notice when it breaks.
 */

import {
  buildFaqJsonLd,
  buildServiceJsonLd,
  buildWebPageJsonLd,
} from "@/lib/landing-jsonld";
import { machinePackages } from "@/lib/rental-data";
import { BUSINESS_ID, SITE_URL } from "@/lib/site";
import type { ContentSection } from "@/lib/landing";
import type { PublicPriceTable } from "@/lib/pricing";

const table: PublicPriceTable = {
  machineBasePrice: () => 124.95,
  mixerPrice: () => 19.95,
  mixerLabel: () => "Margarita",
};

describe("buildServiceJsonLd", () => {
  const node = () =>
    buildServiceJsonLd({
      path: "/service-area/olmos-park",
      areaName: "Olmos Park, San Antonio, TX",
      table,
      priceValidUntil: "2026-09-11",
    });

  // Points at the shared LocalBusiness entity rather than declaring a second
  // business, so these pages reinforce one entity instead of competing.
  it("names the shared business as the provider", () => {
    expect(node().provider).toMatchObject({ "@id": BUSINESS_ID });
  });

  it("scopes its @id to the page", () => {
    expect(node()["@id"]).toBe(`${SITE_URL}/service-area/olmos-park#service`);
  });

  it("emits one Offer per machine package, priced from Settings", () => {
    const offers = node().offers as Record<string, unknown>[];

    expect(offers).toHaveLength(machinePackages.length);
    expect(offers[0]).toMatchObject({
      price: 124.95,
      priceCurrency: "USD",
      // Google may drop an Offer without it.
      priceValidUntil: "2026-09-11",
    });
  });

  // Advertising prices a visitor cannot see on the page is a policy problem,
  // and deleting the pricing section is an easy way to arrive there.
  it("omits offers entirely when the page has no pricing section", () => {
    const withoutPrices = buildServiceJsonLd({
      path: "/x",
      areaName: "X",
      table: null,
      priceValidUntil: "2026-09-11",
    });

    expect(withoutPrices).not.toHaveProperty("offers");
  });

  it("omits areaServed when no area is named", () => {
    const node = buildServiceJsonLd({
      path: "/x",
      table,
      priceValidUntil: "2026-09-11",
    });

    expect(node).not.toHaveProperty("areaServed");
  });
});

describe("buildWebPageJsonLd", () => {
  it("describes the page and links it to the business", () => {
    const node = buildWebPageJsonLd({
      path: "/weddings",
      title: "Weddings",
      description: "Frozen drinks for receptions.",
    });

    expect(node).toMatchObject({
      "@type": "WebPage",
      url: `${SITE_URL}/weddings`,
      name: "Weddings",
      description: "Frozen drinks for receptions.",
      isPartOf: { "@id": BUSINESS_ID },
    });
  });

  it("omits an absent description rather than emitting an empty one", () => {
    expect(buildWebPageJsonLd({ path: "/x", title: "X" })).not.toHaveProperty(
      "description",
    );
  });
});

describe("buildFaqJsonLd", () => {
  const faq = (items: { question: string; answer: string }[]): ContentSection =>
    ({ kind: "faq", items }) as ContentSection;

  it("collects questions across every FAQ section on the page", () => {
    const node = buildFaqJsonLd([
      faq([{ question: "Q1", answer: "A1" }]),
      { kind: "cta" },
      faq([{ question: "Q2", answer: "A2" }]),
    ]);

    expect(node?.mainEntity).toHaveLength(2);
    expect((node?.mainEntity as Record<string, unknown>[])[0]).toMatchObject({
      "@type": "Question",
      name: "Q1",
      acceptedAnswer: { "@type": "Answer", text: "A1" },
    });
  });

  // An empty mainEntity is an invalid FAQPage and Google reports it as an error.
  it("returns null when the page has no FAQ", () => {
    expect(buildFaqJsonLd([{ kind: "cta" }])).toBeNull();
  });

  it("returns null when every entry is half-filled", () => {
    expect(buildFaqJsonLd([faq([{ question: "Q", answer: "" }])])).toBeNull();
  });
});
