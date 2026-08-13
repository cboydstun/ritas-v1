import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SERVICE_AREAS } from "@/lib/service-areas";
import { getPublishedSlugsSafe } from "@/lib/blog-posts";
import {
  getAllLandingPathsSafe,
  getPublishedPathsSafe,
} from "@/lib/landing-page-data";
import { isReservedPath } from "@/lib/landing";

// Revalidated hourly rather than prerendered once at build.
//
// Without this, Next treats the sitemap as a fully static route and freezes it
// into the build. The blog slugs and landing paths below come from the
// database, so every post or page created after a deploy stayed out of the
// sitemap indefinitely — the pages returned 200 and were simply never
// advertised, with nothing failing anywhere to say so. Three published blog
// posts sat unlisted exactly that way. The same rule the settings-reading
// pages follow: a route that reads the database needs `revalidate`.
export const revalidate = 3600;

// Public, indexable routes only — /success is a post-checkout landing page,
// and /admin + /api are disallowed in robots.ts.
const routes: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "monthly" },
  { path: "/order", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/long-term-lease", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.8, changeFrequency: "monthly" },
  // Hub for the per-city pages below, which are otherwise reachable only from
  // each other within a single region.
  { path: "/service-area", priority: 0.75, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
];

// Async now that the blog slugs and the landing paths come from the database. The read goes through
// the `…Safe` helpers, which degrade to an empty list rather than
// throwing: this file is evaluated during prerender, and CI builds against a
// deliberately unreachable MONGODB_URI.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Landing pages, published only, from the same helper the catch-all reads.
  //
  // Then the service-area URLs the catch-all *also* serves from the static
  // fallback: those with no stored document at all, because the seed has not
  // been run. The sitemap has to list exactly what returns 200, and this is
  // the only way to tell "not seeded yet" (renders, so list it) apart from
  // "deliberately unpublished" (404s, so do not). Both reads degrade to an
  // empty list, and an empty stored list means nothing is seeded, so every
  // area is correctly treated as falling back.
  const [publishedPaths, storedPaths] = await Promise.all([
    getPublishedPathsSafe("sitemap"),
    getAllLandingPathsSafe("sitemap"),
  ]);

  const stored = new Set(storedPaths);
  const unseededAreas = SERVICE_AREAS.map(
    (area) => `/service-area/${area.slug}`,
  ).filter((path) => !stored.has(path));

  const paths = [...publishedPaths, ...unseededAreas];

  const landingRoutes = paths
    // A reserved path cannot render, so it must not be advertised — belt and
    // braces against a row written before the reserved check existed.
    .filter((path) => !isReservedPath(path))
    .map((path) => ({
      path,
      priority: 0.7,
      changeFrequency: "monthly" as const,
    }));

  // Published posts only, from the same helper the /blog pages read, so a
  // draft cannot be advertised to Google.
  const blogSlugs = await getPublishedSlugsSafe("sitemap");
  const blogRoutes = blogSlugs.map((slug) => ({
    path: `/blog/${slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  // Deduped by path: a landing page could in principle be created at a path
  // the static list also names, and the same URL twice is a validation error
  // in Search Console.
  const seen = new Set<string>();
  return [...routes, ...landingRoutes, ...blogRoutes]
    .filter(({ path }) => !seen.has(path) && seen.add(path))
    .map(({ path, priority, changeFrequency }) => ({
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }));
}
