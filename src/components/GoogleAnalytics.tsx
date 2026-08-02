import Script from "next/script";
import React from "react";

/**
 * Loads GA4 directly via gtag. This is the only path by which GA4 receives
 * data: GoogleTagManager is also mounted in the root layout, but container
 * GTM-NRQ9HDL9 holds only Google Ads tags (AW-16908257875) and no GA4 tag,
 * so there is no double-counting to resolve. Adding a GA4 tag to the
 * container would introduce some — remove this component if that ever
 * happens.
 */
export default function GoogleAnalytics(): React.ReactNode {
  // Only render in production
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) {
    console.warn("GA4 measurement ID not found in environment variables");
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}');
          `,
        }}
      />
    </>
  );
}
