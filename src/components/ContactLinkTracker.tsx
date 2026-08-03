"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Tracks phone, email and PDF link clicks site-wide.
 *
 * GA4 enhanced measurement does not cover `tel:` or `mailto:` at all, and its
 * `file_download` only fires for cross-origin hrefs — the lease PDF is
 * admin-configurable and may well be same-origin. Rather than bolt an
 * `onClick` onto the five existing anchors (Footer, /contact, /long-term-lease)
 * and have the next one added silently go untracked, this attaches a single
 * delegated listener at the document and matches on href.
 */
export default function ContactLinkTracker(): null {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;

      // `getAttribute` rather than `.href`: the DOM property resolves relative
      // URLs against the page origin, which would break the prefix matching.
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("tel:")) {
        trackEvent("contact_click", { method: "phone", link_url: href });
      } else if (href.startsWith("mailto:")) {
        trackEvent("contact_click", { method: "email", link_url: href });
      } else if (href.toLowerCase().split("?")[0].endsWith(".pdf")) {
        trackEvent("file_download", {
          file_extension: "pdf",
          file_name: anchor.textContent?.trim() || href,
          link_url: href,
        });
      }
    };

    // Capture phase, so a click still registers if a handler further down
    // calls stopPropagation.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
