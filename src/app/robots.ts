import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /success is a post-checkout landing page whose URL carries a
      // bookingId. Its metadata.ts sets robots.index=false, but page.tsx is a
      // client component so Next never emits it — this is the block that
      // actually keeps confirmation URLs out of the index.
      disallow: ["/admin/", "/api/", "/success"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
