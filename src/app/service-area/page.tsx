import { Metadata } from "next";
import Link from "next/link";
import BookingCTA from "@/components/BookingCTA";
import {
  SERVICE_AREAS,
  SERVICE_AREA_REGIONS,
  serviceAreasByRegion,
} from "@/lib/service-areas";
import {
  BUSINESS_ID,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_HREF,
  SITE_URL,
} from "@/lib/site";

/**
 * Hub for the 16 `/service-area/[city]` pages.
 *
 * Without it the bare `/service-area` path was a hard 404, and the city pages
 * linked only to others in their own region — four disconnected islands with
 * nothing tying them together or back to the site.
 */
export const metadata: Metadata = {
  title: "Service Areas | Margarita Machine Delivery Across San Antonio",
  description:
    "Frozen drink and margarita machine rental delivered across San Antonio and Bexar County — downtown, Alamo Heights, Stone Oak, Helotes, Schertz and more.",
  alternates: { canonical: "/service-area" },
  openGraph: {
    title: "Where We Deliver | SATX Ritas Rentals",
    description:
      "Margarita machine delivery, setup and pickup across San Antonio and Bexar County.",
    url: `${SITE_URL}/service-area`,
    images: [`${SITE_URL}/og-image.jpg`],
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "Service Areas",
      item: `${SITE_URL}/service-area`,
    },
  ],
};

export default function ServiceAreaIndexPage() {
  return (
    <div className="bg-light dark:bg-charcoal">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="max-w-5xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex gap-2 text-sm text-charcoal/60 dark:text-white/60">
            <li>
              <Link href="/" className="hover:text-margarita underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Service Areas</li>
          </ol>
        </nav>

        <h1 className="text-4xl font-bold text-charcoal dark:text-white mb-4">
          Where We Deliver
        </h1>
        <p className="text-lg text-charcoal/70 dark:text-white/70 max-w-3xl mb-12">
          We deliver, set up and collect frozen drink machines across San
          Antonio and Bexar County. Pick your area below for delivery notes and
          pricing, or{" "}
          <a href={BUSINESS_PHONE_HREF} className="text-margarita underline">
            call {BUSINESS_PHONE_DISPLAY}
          </a>{" "}
          if you are just outside it — we can often still help.
        </p>

        <div className="grid gap-10 sm:grid-cols-2">
          {SERVICE_AREA_REGIONS.map((region) => (
            <div key={region}>
              <h2 className="text-xl font-semibold text-charcoal dark:text-white mb-4">
                {region} San Antonio
              </h2>
              <ul className="space-y-3">
                {serviceAreasByRegion(region).map((area) => (
                  <li key={area.slug}>
                    <Link
                      href={`/service-area/${area.slug}`}
                      className="block rounded-xl border border-charcoal/10 dark:border-white/10 p-4 hover:border-margarita transition-colors"
                    >
                      <span className="font-medium text-charcoal dark:text-white">
                        {area.name}
                      </span>
                      <span className="block text-sm text-charcoal/60 dark:text-white/60 mt-1">
                        {area.blurb}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm text-charcoal/60 dark:text-white/60">
          {SERVICE_AREAS.length} areas covered, and growing.
        </p>
      </section>

      <BookingCTA />
      <span className="hidden" data-business-id={BUSINESS_ID} />
    </div>
  );
}
