import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingCTA from "@/components/BookingCTA";
import { machinePackages } from "@/lib/rental-data";
import { formatPrice } from "@/lib/pricing";
import {
  SERVICE_AREAS,
  getServiceArea,
  type ServiceArea,
} from "@/lib/service-areas";
import {
  BUSINESS_ID,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_E164,
  BUSINESS_PHONE_HREF,
  SITE_URL,
} from "@/lib/site";

interface PageProps {
  params: Promise<{ city: string }>;
}

export function generateStaticParams() {
  return SERVICE_AREAS.map((area) => ({ city: area.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city } = await params;
  const area = getServiceArea(city);
  // A bare `{}` left an unknown slug inheriting the root title on a 404.
  if (!area) return { title: "Area Not Found", robots: { index: false } };

  return {
    title: `Margarita Machine Rental in ${area.name} | SATX Ritas`,
    description: `Frozen drink and margarita machine rental delivered to ${area.name}, San Antonio. ${area.blurb}`,
    alternates: { canonical: `/service-area/${area.slug}` },
    openGraph: {
      title: `Margarita Machine Rental in ${area.name}`,
      description: `Delivery, setup and pickup in ${area.name}. ${area.blurb}`,
      url: `${SITE_URL}/service-area/${area.slug}`,
      images: [`${SITE_URL}/og-image.jpg`],
      type: "website",
    },
  };
}

/**
 * The `Service` node points back at the shared LocalBusiness `@id` rather than
 * describing a second business, so these pages reinforce one entity instead of
 * competing with it.
 */
function buildBreadcrumbs(area: ServiceArea) {
  return {
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
      {
        "@type": "ListItem",
        position: 3,
        name: area.name,
        item: `${SITE_URL}/service-area/${area.slug}`,
      },
    ],
  };
}

function buildJsonLd(area: ServiceArea) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}/service-area/${area.slug}#service`,
    serviceType: "Frozen drink machine rental",
    provider: {
      "@type": "LocalBusiness",
      "@id": BUSINESS_ID,
      name: "SATX Ritas Rentals",
      telephone: BUSINESS_PHONE_E164,
      url: SITE_URL,
    },
    areaServed: {
      "@type": "Place",
      name: `${area.name}, San Antonio, TX`,
    },
    offers: machinePackages.map((pkg) => ({
      "@type": "Offer",
      name: pkg.name,
      price: pkg.basePrice,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    })),
  };
}

export default async function ServiceAreaPage({ params }: PageProps) {
  const { city } = await params;
  const area = getServiceArea(city);
  if (!area) notFound();

  const sameRegion = SERVICE_AREAS.filter(
    (other) => other.region === area.region && other.slug !== area.slug,
  );
  // Filtering to the same region alone split the 16 pages into four
  // disconnected islands with no path between them. Two picks from other
  // regions — chosen deterministically so the markup stays stable across
  // builds — join them up.
  const otherRegions = SERVICE_AREAS.filter(
    (other) => other.region !== area.region,
  );
  const offset = SERVICE_AREAS.findIndex((a) => a.slug === area.slug);
  const crossRegion = otherRegions.length
    ? [0, 1].map((i) => otherRegions[(offset + i) % otherRegions.length])
    : [];
  const nearby = [...sameRegion, ...crossRegion];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(area)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbs(area)),
        }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap gap-2 text-sm text-charcoal/60 dark:text-white/60">
            <li>
              <Link href="/" className="hover:text-margarita underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/service-area"
                className="hover:text-margarita underline"
              >
                Service Areas
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{area.name}</li>
          </ol>
        </nav>

        <p className="text-sm font-semibold uppercase tracking-wide text-teal mb-3">
          {area.region} San Antonio
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-charcoal dark:text-white mb-4">
          Margarita Machine Rental in {area.name}
        </h1>
        <p className="text-lg text-charcoal/80 dark:text-white/80 mb-8 max-w-3xl">
          {area.blurb} We deliver, set up and collect the machine, so all you
          provide is a power outlet and the ice.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-12">
          <Link
            href="/order"
            className="px-6 py-3 rounded-xl font-bold text-center text-white bg-margarita hover:bg-teal transition-colors"
          >
            Check availability for your date
          </Link>
          <a
            href={BUSINESS_PHONE_HREF}
            className="px-6 py-3 rounded-xl font-bold text-center text-margarita border-2 border-margarita hover:bg-margarita hover:text-white transition-colors"
          >
            Call {BUSINESS_PHONE_DISPLAY}
          </a>
        </div>

        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
          Machines available in {area.name}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {machinePackages.map((pkg) => (
            <div
              key={pkg.type}
              className="bg-light dark:bg-charcoal/50 rounded-xl p-6"
            >
              <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-1">
                {pkg.name}
              </h3>
              <p className="text-2xl font-bold text-margarita mb-3">
                ${formatPrice(pkg.basePrice)}
                <span className="text-sm font-normal text-charcoal/70 dark:text-white/70">
                  {" "}
                  / day
                </span>
              </p>
              <p className="text-sm text-charcoal/80 dark:text-white/80">
                {pkg.description}
              </p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-4">
          What delivery to {area.name} includes
        </h2>
        <ul className="space-y-2 text-charcoal/80 dark:text-white/80 mb-12">
          <li>🚚 Delivery and pickup — a flat fee, no per-mile charge.</li>
          <li>🔧 Setup and a walkthrough of the controls before we leave.</li>
          <li>🧼 Cleaning after the event; you never rinse a tank.</li>
          <li>
            🍹 Mixer concentrate for each tank, or bring your own — Texas law
            prevents us from supplying alcohol.
          </li>
        </ul>

        {nearby.length > 0 && (
          <>
            <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-4">
              We also deliver nearby
            </h2>
            <ul className="flex flex-wrap gap-3 mb-12">
              {nearby.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`/service-area/${other.slug}`}
                    className="inline-block px-4 py-2 rounded-lg bg-light dark:bg-charcoal/50 text-charcoal dark:text-white hover:text-margarita transition-colors"
                  >
                    {other.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mb-12 text-sm text-charcoal/60 dark:text-white/60">
              <Link
                href="/service-area"
                className="text-margarita underline hover:no-underline"
              >
                See every area we deliver to
              </Link>
            </p>
          </>
        )}

        <BookingCTA />
      </div>
    </>
  );
}
