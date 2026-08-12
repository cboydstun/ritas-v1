import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SERVICE_AREAS } from "@/lib/service-areas";
import { getPublishedSlugsSafe } from "@/lib/blog-posts";

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

// Async now that the blog slugs come from the database. The read goes through
// `getPublishedSlugsSafe`, which degrades to an empty list rather than
// throwing: this file is evaluated during prerender, and CI builds against a
// deliberately unreachable MONGODB_URI.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Generated from the same list the pages and the homepage map render from,
  // so a new area cannot be added and then quietly left out of the sitemap.
  const serviceAreaRoutes = SERVICE_AREAS.map((area) => ({
    path: `/service-area/${area.slug}`,
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

  return [...routes, ...serviceAreaRoutes, ...blogRoutes].map(
    ({ path, priority, changeFrequency }) => ({
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }),
  );
}
