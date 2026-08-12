"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getConsent } from "@/lib/consent";

export default function FingerprintTracker() {
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState<string | null>(null);

  useEffect(() => {
    // Skip tracking for admin pages
    if (pathname.startsWith("/admin")) {
      return;
    }

    // The consent banner promises "You can opt out at any time", but opting
    // out only downgraded Google Consent Mode — this first-party fingerprint
    // (a ThumbmarkJS hash plus userAgent, platform, screen metrics, timezone
    // and storage capabilities) kept posting on every page view regardless.
    if (getConsent() === "denied") {
      return;
    }

    // Helper function for exponential backoff retry
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Track page view with retry logic
    const trackPageView = async (retryCount = 0, maxRetries = 3) => {
      try {
        // Imported lazily: this component is mounted in the root layout, so a
        // static import put the whole fingerprinting library in the shared
        // client bundle for every page, including the homepage LCP path.
        const { getFingerprint } = await import("@thumbmarkjs/thumbmarkjs");
        const fingerprintResult = await getFingerprint();

        // Validate fingerprint was generated
        if (!fingerprintResult) {
          console.warn("Fingerprint generation returned empty result");
          return;
        }

        // Prepare data with mock component data since thumbarkjs doesn't expose components directly
        const data = {
          fingerprintHash: fingerprintResult,
          components: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            colorDepth: window.screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            sessionStorage: !!window.sessionStorage,
            localStorage: !!window.localStorage,
            indexedDb: !!window.indexedDB,
            cookiesEnabled: navigator.cookieEnabled,
          },
          page: pathname,
          referrer: document.referrer || null,
        };

        // Send to API
        const response = await fetch("/api/v1/analytics/fingerprint", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          // Get detailed error information
          let errorMessage = `Failed to send fingerprint data (Status: ${response.status})`;
          let shouldRetry = false;

          try {
            const errorData = await response.json();
            errorMessage += ` - ${errorData.error || "Unknown error"}`;
            console.error("API Error Details:", errorData);

            // Retry on 503 (service unavailable) or 500 (server error)
            shouldRetry = response.status === 503 || response.status === 500;
          } catch {
            const errorText = await response.text();
            console.error("API Error Response:", errorText);
            shouldRetry = response.status >= 500;
          }

          // Retry with exponential backoff for server errors
          if (shouldRetry && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
            await sleep(delay);
            return trackPageView(retryCount + 1, maxRetries);
          }

          throw new Error(errorMessage);
        }

        // Log success for debugging
        const result = await response.json();
        if (process.env.NODE_ENV === "development") {
        }
      } catch (error) {
        // Enhanced error logging
        console.error("Error tracking page view:", {
          error: error instanceof Error ? error.message : error,
          page: pathname,
          timestamp: new Date().toISOString(),
        });

        // Fail silently - don't disrupt user experience
      }
    };

    // Only track if the path has changed
    if (pathname !== lastPath) {
      trackPageView();
      setLastPath(pathname);
    }
  }, [pathname, lastPath]);

  return null; // This component doesn't render anything
}
