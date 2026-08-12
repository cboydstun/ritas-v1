import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /success is deliberately NOT disallowed. It is a post-checkout landing
      // page whose URL carries a bookingId, and `success/metadata.ts` sets
      // `robots.index: false` — which page.tsx now actually emits, since it was
      // converted to a server shell. Blocking the path here would stop Google
      // fetching the page at all, so it could never read that noindex, and a
      // linked confirmation URL would still surface as a bare URL result.
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
