import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionRenderer from "@/components/landing/SectionRenderer";
import {
  publicPriceTable,
  offerPriceValidUntil,
  type PricingOverrides,
} from "@/lib/pricing";
import { getPublicSettingsSafe } from "@/lib/public-settings";
import {
  getPublishedBlocksSafe,
  getPublishedPageByPathSafe,
  getPublishedPathsSafe,
} from "@/lib/landing-page-data";
import {
  isReservedPath,
  landingPathFromSegments,
  landingPathToSegments,
  resolveSections,
  type LandingPageRecord,
} from "@/lib/landing";
import {
  buildFaqJsonLd,
  buildServiceJsonLd,
  buildWebPageJsonLd,
} from "@/lib/landing-jsonld";
import { SERVICE_AREAS } from "@/lib/service-areas";
import { SITE_URL, breadcrumbJsonLd } from "@/lib/site";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

/**
 * Every database-backed landing page, served from one route.
 *
 * `[...slug]`, not `[[...slug]]` — an optional catch-all at the root conflicts
 * with `src/app/page.tsx` and fails the build.
 *
 * Next matches static and `[param]` routes before a catch-all, so `/order`,
 * `/pricing`, `/blog/*` and the `/service-area` hub all still win. That is
 * also why `isReservedPath` refuses to store a page at one of those paths: it
 * would save and then never render.
 */

// Reads Settings and the database, so without this the prices freeze into the
// build — exactly how /long-term-lease hid lease-tier edits until the next
// deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  const paths = await getPublishedPathsSafe("landing generateStaticParams");

  // Unioned with the static list, because CI builds against a deliberately
  // unreachable MONGODB_URI: the read degrades to `[]`, and without this the
  // build would prerender no landing pages at all and the 16 highest-value
  // SEO URLs would be cold dynamic renders after every deploy.
  const seeded = SERVICE_AREAS.map((area) => `/service-area/${area.slug}`);

  return [...new Set([...paths, ...seeded])].map((path) => ({
    slug: landingPathToSegments(path),
  }));
}

// dynamicParams is left at its default `true`, so a page published after the
// build renders on first request instead of 404ing until the next deploy.

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const path = landingPathFromSegments((await params).slug);
  const page = path ? await getPublishedPageByPathSafe("metadata", path) : null;

  // A bare `{}` would leave a 404 inheriting the root title.
  if (!page) return { title: "Page Not Found", robots: { index: false } };

  const description = page.seoDescription ?? "";
  const image = page.ogImagePath
    ? `${SITE_URL}${page.ogImagePath}`
    : `${SITE_URL}/og-image.jpg`;

  return {
    title: page.seoTitle || page.title,
    description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.seoTitle || page.title,
      description,
      url: `${SITE_URL}${page.path}`,
      images: [image],
      type: "website",
    },
  };
}

function Breadcrumbs({ page }: { page: LandingPageRecord }) {
  const trail = page.breadcrumbs ?? [];
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap gap-2 text-sm text-charcoal/60 dark:text-white/60">
        <li>
          <Link href="/" className="hover:text-margarita underline">
            Home
          </Link>
        </li>
        {trail.map((crumb, index) => (
          <li key={crumb.path} className="flex gap-2">
            <span aria-hidden="true">/</span>
            {index === trail.length - 1 ? (
              <span aria-current="page">{crumb.name}</span>
            ) : (
              <Link
                href={crumb.path}
                className="hover:text-margarita underline"
              >
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default async function LandingPage({ params }: PageProps) {
  const { slug } = await params;

  // Both guards are pure string work and run before any I/O, so a crawler
  // probing /wp-login.php costs no database round trip.
  const path = landingPathFromSegments(slug);
  if (!path || isReservedPath(path)) notFound();

  // The query hardcodes `status: "published"`, so an unknown path and a draft
  // are indistinguishable from out here — which is the point.
  const page = await getPublishedPageByPathSafe("landing page", path);
  if (!page) notFound();

  const blocks = await getPublishedBlocksSafe("landing page", page.sections);
  const sections = resolveSections(page.sections, blocks);

  // Settings is read only when something on the page needs a price. A page
  // with no pricing card should not pay that round trip on every regeneration.
  const needsPricing = sections.some(
    (section) => section.kind === "pricingCards",
  );
  const settings = needsPricing
    ? await getPublicSettingsSafe("Landing page")
    : null;
  const table = settings
    ? publicPriceTable({
        machines: settings.machines as PricingOverrides["machines"],
        mixers: settings.mixers as PricingOverrides["mixers"],
      })
    : null;

  const pageNode =
    page.schemaType === "Service"
      ? buildServiceJsonLd({
          path: page.path,
          areaName: page.serviceAreaName,
          table,
          priceValidUntil: offerPriceValidUntil(),
        })
      : page.schemaType === "WebPage"
        ? buildWebPageJsonLd({
            path: page.path,
            title: page.title,
            description: page.seoDescription,
          })
        : null;

  const faqNode = page.schemaType === "none" ? null : buildFaqJsonLd(sections);

  const trail = page.breadcrumbs ?? [];

  return (
    <>
      {pageNode && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(pageNode) }}
        />
      )}
      {/* The shared helper, replacing the copy the hand-written city page
          carried. It prepends Home itself. */}
      {trail.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd(trail)),
          }}
        />
      )}
      {faqNode && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqNode) }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs page={page} />
        {sections.map((section, index) => (
          <SectionRenderer key={index} section={section} table={table} />
        ))}
      </div>
    </>
  );
}
