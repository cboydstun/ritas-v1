import { machinePackages } from "@/lib/rental-data";
import { type PublicPriceTable } from "@/lib/pricing";
import { BUSINESS_ID, BUSINESS_PHONE_E164, SITE_URL } from "@/lib/site";
import type { ContentSection } from "@/lib/landing";

/**
 * Structured-data builders for the landing pages.
 *
 * These live in `lib` rather than in the page component so they are unit
 * testable — the JSON-LD is the part of these pages Google reads, and it is
 * the part with no visual regression to notice when it breaks.
 */

/**
 * The `Service` node, carried over verbatim from the hand-written
 * `/service-area/[city]` page.
 *
 * It points `provider` at the shared LocalBusiness `@id` rather than declaring
 * a second business, so these pages reinforce one entity instead of competing
 * with it.
 *
 * `offers` is omitted when the page carries no pricing section. Advertising
 * prices in structured data that a visitor cannot see on the page is a Google
 * policy problem, and deleting the pricing section is an easy way for an admin
 * to arrive there without noticing.
 */
export function buildServiceJsonLd(options: {
  path: string;
  areaName?: string;
  table: PublicPriceTable | null;
  priceValidUntil: string;
}): Record<string, unknown> {
  const { path, areaName, table, priceValidUntil } = options;

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}${path}#service`,
    serviceType: "Frozen drink machine rental",
    provider: {
      "@type": "LocalBusiness",
      "@id": BUSINESS_ID,
      name: "SATX Ritas Rentals",
      telephone: BUSINESS_PHONE_E164,
      url: SITE_URL,
    },
  };

  if (areaName) {
    node.areaServed = { "@type": "Place", name: areaName };
  }

  if (table) {
    // Prices come from Settings, not the rental-data constants: these Offer
    // nodes used to contradict what the order wizard would actually charge
    // after an admin price change. priceValidUntil keeps the rich result
    // eligible — Google may drop an Offer without it.
    node.offers = machinePackages.map((pkg) => ({
      "@type": "Offer",
      name: pkg.name,
      price: table.machineBasePrice(pkg.type),
      priceCurrency: "USD",
      priceValidUntil,
      availability: "https://schema.org/InStock",
    }));
  }

  return node;
}

/** A plain WebPage node, for a landing page that is not a service pitch. */
export function buildWebPageJsonLd(options: {
  path: string;
  title: string;
  description?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${options.path}#webpage`,
    url: `${SITE_URL}${options.path}`,
    name: options.title,
    ...(options.description ? { description: options.description } : {}),
    isPartOf: { "@id": BUSINESS_ID },
  };
}

/**
 * Derived from the page's own FAQ sections rather than stored separately, so
 * the structured data cannot drift from what the visitor reads.
 *
 * Returns null when there is nothing to describe — an empty `mainEntity` is an
 * invalid FAQPage and Google reports it as an error.
 */
export function buildFaqJsonLd(
  sections: ContentSection[],
): Record<string, unknown> | null {
  const items = sections
    .filter((section) => section.kind === "faq")
    .flatMap((section) => section.items)
    .filter((item) => item.question && item.answer);

  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
