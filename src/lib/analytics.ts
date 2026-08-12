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
 * Every event name the site sends.
 *
 * All of these except `order_step` and `contact_click` are GA4 recommended
 * events and register themselves; those two are custom. Marking one as a key
 * event is a GA4-admin decision, not a code one — and `order_step` in
 * particular must NOT be one: it fires up to five times per visitor and once
 * more on every backwards step, so counting it as a conversion drowns the
 * three that matter and would teach Smart Bidding to optimise for step two of
 * a form.
 */
export type AnalyticsEvent =
  | "purchase"
  | "begin_checkout"
  | "order_step"
  | "generate_lead"
  | "contact_click"
  | "file_download"
  | "view_item_list"
  | "view_item"
  | "select_item"
  | "add_to_cart"
  | "remove_from_cart";

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

/**
 * Every custom `dataLayer` event the site pushes for GTM to trigger on.
 *
 * These exist because the Google Ads conversion tags need to fire on a real
 * outcome carrying real values, and neither was available where they used to
 * be wired. `purchase_complete` replaces a `/success` pageview trigger that
 * could not see the order total — `buildSuccessUrl` deliberately keeps money
 * and PII out of the URL, so the value has to arrive out of band.
 * `lead_submitted` replaces GTM's built-in Form Submission trigger, which
 * fires on the browser's submit event and therefore counted submissions whose
 * API call went on to fail (`preventDefault` does not suppress it).
 */
export type DataLayerEvent = "purchase_complete" | "lead_submitted";

/**
 * Push a custom event to the GTM `dataLayer`.
 *
 * The array is created by the GTM bootstrap in `GoogleTagManager.tsx`, which
 * is production-gated — so in development, behind an ad blocker, and for the
 * moment before the container loads, this is a no-op rather than a throw, for
 * the same reason `trackEvent` optional-chains `gtag`. Analytics must never be
 * able to break a booking.
 */
export function pushDataLayer(
  event: DataLayerEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  window.dataLayer?.push({ event, ...params });
}
