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
 * `contact_click` gives Ads a phone-lead signal on organic traffic: the
 * existing Google Ads call tag does dynamic number insertion, which only ever
 * converts visitors who arrived from an ad, so a tel: tap from the ~73% of
 * sessions that come from organic search was invisible to it.
 *
 * The same name being both an `AnalyticsEvent` and a `DataLayerEvent` is
 * deliberate — one visitor action, two transports, and they should not drift
 * apart in the reports.
 */
export type DataLayerEvent =
  "purchase_complete" | "lead_submitted" | "contact_click";

/**
 * What one lead of each kind is worth, in USD.
 *
 * These are bidding inputs, not accounting. Google Ads compares conversion
 * values against each other to decide where to spend, so what matters is the
 * ratio: a lease inquiry is recurring commercial revenue and is weighted at
 * twenty times an event enquiry, while a phone tap sits between the two.
 * Against a $206 average order value, a $25 contact lead implies roughly a one
 * in eight close rate — deliberately conservative, because overstating a lead
 * pulls spend away from completed bookings, which are the thing actually worth
 * buying.
 *
 * Both transports read from here. They used to send no value at all, which
 * left GA4 reporting every lead at $0 while Ads quietly substituted the
 * conversion action's own default — two numbers for one event, neither of them
 * chosen on purpose.
 */
export const LEAD_VALUES = {
  contact: 25,
  lease_inquiry: 500,
  phone_call: 50,
} as const;

/** Currency for every value this module reports. The business is US-only. */
export const ANALYTICS_CURRENCY = "USD";

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

/**
 * How long to wait for GTM to report that every tag on a push has fired.
 *
 * This is also passed to GTM as `eventTimeout`, so the container gives up on a
 * slow tag at the same moment we stop waiting for it, rather than invoking the
 * callback after we have already navigated away.
 */
export const DATALAYER_CALLBACK_TIMEOUT_MS = 2000;

/**
 * Push an event and run `done` once GTM has finished firing its tags.
 *
 * `pushDataLayer` is fire-and-forget, which is correct everywhere the page
 * stays put. It is *not* correct before a navigation: `gtag` beacons its own
 * hits with `sendBeacon` and survives, but a Google Ads conversion tag fired
 * by the container is a separate request the container issues itself, and
 * assigning `window.location` in the same tick can cut it off before it
 * leaves. That loses the conversion silently — no error anywhere, the booking
 * still succeeds, and Ads simply never hears about it.
 *
 * `eventCallback`/`eventTimeout` are GTM's documented mechanism for this. Both
 * are needed: the callback for the normal case, and the timeout for the cases
 * where it will never arrive — no container in development, an ad blocker, a
 * consent denial that suppresses every tag on the push. `done` runs exactly
 * once whichever way it resolves, because stranding a customer on the review
 * step after their booking has been written is far worse than a lost
 * conversion.
 */
export function pushDataLayerThen(
  event: DataLayerEvent,
  params: Record<string, unknown>,
  done: () => void,
  timeoutMs: number = DATALAYER_CALLBACK_TIMEOUT_MS,
): void {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    done();
  };

  // No container to wait for — do not make the caller pay the timeout.
  if (typeof window === "undefined" || !window.dataLayer) {
    finish();
    return;
  }

  const timer = window.setTimeout(finish, timeoutMs);
  window.dataLayer.push({
    event,
    ...params,
    eventTimeout: timeoutMs,
    eventCallback: () => {
      window.clearTimeout(timer);
      finish();
    },
  });
}
