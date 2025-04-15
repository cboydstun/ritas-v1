"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getFingerprint } from "@thumbmarkjs/thumbmarkjs";

export default function FingerprintTracker() {
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState<string | null>(null);
  
  useEffect(() => {
    // Skip tracking for admin pages
    if (pathname.startsWith("/admin")) {
      return;
    }
    
    // Track page view
    const trackPageView = async () => {
      try {
        // Get fingerprint
        const fingerprintResult = await getFingerprint();
        
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
          referrer: document.referrer || null
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
          throw new Error("Failed to send fingerprint data");
        }
      } catch (error) {
        console.error("Error tracking page view:", error);
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
