"use client";

import { useEffect } from "react";
import { trackEvent, pushDataLayer } from "@/lib/analytics";

/**
 * Tracks phone, email and PDF link clicks site-wide.
 *
 * GA4 enhanced measurement does not cover `tel:` or `mailto:` at all, and its
 * `file_download` only fires for cross-origin hrefs — the lease PDF is
 * admin-configurable and may well be same-origin. Rather than bolt an
 * `onClick` onto the five existing anchors (Footer, /contact, /long-term-lease)
 * and have the next one added silently go untracked, this attaches a single
 * delegated listener at the document and matches on href.
 *
 * A download is recognised by `data-track-download="pdf"` **or** a `.pdf`
 * extension. The attribute is the reliable half: `Settings.documentation`
 * only validates that the URL is `http(s)`, so a Drive or Dropbox share link
 * — or any signed URL with the extension buried in a query string — renders a
 * perfectly good download button that extension-sniffing silently misses.
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

      const method = href.startsWith("tel:")
        ? "phone"
        : href.startsWith("mailto:")
          ? "email"
          : null;

      if (method) {
        trackEvent("contact_click", { method, link_url: href });
        // Mirrored to the dataLayer so a Google Ads conversion tag can fire on
        // it. The Ads call tag only converts ad-click traffic, so without this
        // a tel: tap from organic search — most of the site's traffic — reached
        // Ads not at all. GTM filters this to `method === "phone"`; the email
        // case is pushed too so the trigger stays a filter rather than an
        // assumption about what the site emits.
        pushDataLayer("contact_click", { method });
      } else if (
        anchor.dataset.trackDownload === "pdf" ||
        href.toLowerCase().split(/[?#]/)[0].endsWith(".pdf")
      ) {
        trackEvent("file_download", {
          file_extension: "pdf",
          file_name: anchor.textContent?.trim() || href,
          link_url: href,
        });
      }
    };

    // Capture phase, so a click still registers if a handler further down
    // calls stopPropagation. `auxclick` covers middle-click and the
    // open-in-new-tab gesture, which fire no `click` at all — on a phone-first
    // site that matters least for `tel:` and most for the PDF.
    document.addEventListener("click", handleClick, true);
    document.addEventListener("auxclick", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("auxclick", handleClick, true);
    };
  }, []);

  return null;
}
