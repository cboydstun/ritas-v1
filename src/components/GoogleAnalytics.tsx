import Script from "next/script";
import React from "react";

/**
 * Loads GA4 directly via gtag. This is the only path by which GA4 receives
 * data: GoogleTagManager is also mounted in the root layout, but container
 * GTM-NRQ9HDL9 holds only Google Ads tags (AW-16908257875) and no GA4 tag,
 * so there is no double-counting to resolve. Adding a GA4 tag to the
 * container would introduce some — remove this component if that ever
 * happens.
 *
 * The inline script also emits the Consent Mode v2 defaults. They must land in
 * dataLayer before `config` and before GTM boots, which is why they are
 * inlined here rather than set from a React effect. Defaults are `granted`:
 * Texas TDPSA is an opt-out regime, so `CookieConsent` downgrades on request
 * instead of withholding by default. Flip these to `denied` if the site ever
 * serves EU traffic — the rest of the wiring is unchanged.
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
            window.gtag = gtag;
            gtag('consent', 'default', {
              ad_storage: 'granted',
              ad_user_data: 'granted',
              ad_personalization: 'granted',
              analytics_storage: 'granted',
              functionality_storage: 'granted',
              security_storage: 'granted'
            });
            try {
              if (localStorage.getItem('satx-ritas-consent') === 'denied') {
                gtag('consent', 'update', {
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied',
                  analytics_storage: 'denied'
                });
              }
            } catch (e) {}
            gtag('js', new Date());
            gtag('config', '${measurementId}');
          `,
        }}
      />
    </>
  );
}
