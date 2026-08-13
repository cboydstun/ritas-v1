import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SectionRenderer from "@/components/landing/SectionRenderer";
import { publicPriceTable, type PricingOverrides } from "@/lib/pricing";
import { getPublicSettingsSafe } from "@/lib/public-settings";
import {
  getBlocksForPreview,
  getPageForPreview,
} from "@/lib/landing-page-data";
import {
  blockSlugsIn,
  landingPathFromSegments,
  resolveSections,
} from "@/lib/landing";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

/**
 * Renders a landing page of any status, through the same `SectionRenderer` the
 * public route uses.
 *
 * It lives under `/admin/*` so the proxy matcher in `src/proxy.ts` already
 * authenticates it, `robots.ts` already disallows it, and `AnalyticsGate`
 * already keeps GA4 and the fingerprint tracker off it — an admin previewing
 * their own drafts should not be generating pageviews against them.
 *
 * The alternative, a `?preview=` search param on the public route, was
 * rejected: reading `searchParams` in a page component opts the route out of
 * static rendering for *every* visitor, which would turn each landing page
 * into a per-request database round trip so that one admin can see a draft.
 *
 * Not wrapped in `AdminLayout` on purpose — that is the sidebar shell, and it
 * would destroy the fidelity of the thing being previewed.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false },
};

export default async function LandingPreviewPage({ params }: PageProps) {
  // The proxy rejects an unauthenticated request before this runs. This is the
  // redundant second layer every admin route handler in this app also carries.
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") notFound();

  const path = landingPathFromSegments((await params).slug);
  if (!path) notFound();

  const page = await getPageForPreview(path);
  if (!page) notFound();

  // Draft blocks resolve here, unlike on the public route, so the admin sees
  // what the page will look like once everything on it is published.
  const blocks = await getBlocksForPreview(blockSlugsIn(page.sections));
  const sections = resolveSections(page.sections, blocks);

  const needsPricing = sections.some(
    (section) => section.kind === "pricingCards",
  );
  const settings = needsPricing
    ? await getPublicSettingsSafe("Landing preview")
    : null;
  const table = settings
    ? publicPriceTable({
        machines: settings.machines as PricingOverrides["machines"],
        mixers: settings.mixers as PricingOverrides["mixers"],
      })
    : null;

  return (
    <>
      <div className="sticky top-0 z-50 bg-amber-400 text-charcoal px-4 py-2 text-sm font-semibold text-center">
        {page.status === "published" ? "Preview" : "Draft preview"} of{" "}
        <span className="font-mono">{page.path}</span> — this is the last saved
        version, not unsaved edits.
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {sections.map((section, index) => (
          <SectionRenderer key={index} section={section} table={table} />
        ))}
      </div>
    </>
  );
}
