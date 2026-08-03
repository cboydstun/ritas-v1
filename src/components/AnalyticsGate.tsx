"use client";

import { usePathname } from "next/navigation";
import GoogleAnalytics from "./GoogleAnalytics";
import GoogleTagManager, { GoogleTagManagerNoscript } from "./GoogleTagManager";

/**
 * Mounts the GA4 and GTM tags everywhere except the admin area.
 *
 * The tags live in the root layout, which also wraps `src/app/admin/layout.tsx`
 * — so every admin page view and every `/admin/login` hit was counted as
 * customer traffic, skewing engagement and landing-page reports on a site with
 * only a handful of sessions a day. `FingerprintTracker` already skips
 * `/admin` the same way; this brings GA4 in line.
 *
 * `NEXT_PUBLIC_*` env reads still work here: Next inlines them at build time,
 * so the child components behave identically as client components.
 */
export default function AnalyticsGate(): React.ReactNode {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  // GoogleAnalytics must precede GoogleTagManager: it emits the Consent Mode
  // defaults, which have to be in dataLayer before the container loads.
  return (
    <>
      <GoogleTagManagerNoscript />
      <GoogleAnalytics />
      <GoogleTagManager />
    </>
  );
}
