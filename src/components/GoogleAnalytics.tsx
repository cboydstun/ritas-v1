import Script from "next/script";
import React from "react";

/**
 * Loads GA4 (G-JW4KW6SW3G) directly via gtag.
 *
 * NOTE: GoogleTagManager is also mounted in the root layout. If the GTM
 * container fires its own GA4 tag for this same measurement ID, every
 * pageview and conversion is counted twice. Resolving that needs a look at
 * the container config, not the code — check GTM, then delete whichever of
 * the two is redundant.
 */
export default function GoogleAnalytics(): React.ReactNode {
  // Only render in production
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-JW4KW6SW3G"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-JW4KW6SW3G');
          `,
        }}
      />
    </>
  );
}
