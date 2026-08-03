/**
 * The single choke point for every GA4 event the site emits.
 *
 * `GoogleAnalytics.tsx` installs `window.gtag`; nothing else should call it
 * directly. Routing every event through here keeps the event names in one
 * typed union (so a typo is a compile error rather than a silently orphaned
 * event in the GA4 UI) and gives the tests one seam to assert against.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Every event name the site sends. `purchase`, `begin_checkout`,
 * `generate_lead` and `file_download` are GA4 recommended events and register
 * themselves; `order_step` and `contact_click` are custom and must be marked
 * as key events in the GA4 admin before they count for anything.
 */
export type AnalyticsEvent =
  | "purchase"
  | "begin_checkout"
  | "order_step"
  | "generate_lead"
  | "contact_click"
  | "file_download";

/**
 * Send an event to GA4.
 *
 * `gtag` is absent in development (the component is production-gated), behind
 * an ad blocker, and for the moment before the script finishes loading. The
 * optional call makes all three a no-op instead of a throw — analytics must
 * never be able to break a booking.
 */
export function trackEvent(
  name: AnalyticsEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, params);
}
