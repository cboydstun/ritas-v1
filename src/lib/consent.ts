/**
 * Google Consent Mode v2 state.
 *
 * Posture: the defaults emitted by `GoogleAnalytics.tsx` are `granted`, and
 * this module only ever downgrades them. Texas TDPSA — the law that actually
 * applies to this business — is an opt-out regime, not GDPR's opt-in, so
 * defaulting to `denied` would gut measurement for no legal gain. If the site
 * ever serves EU traffic, flip the defaults in `GoogleAnalytics.tsx` to
 * `denied` and this wiring keeps working unchanged.
 */

/**
 * Matches the `satx-ritas-order-draft` key convention used by OrderForm.
 *
 * Kept in sync by hand with the inline bootstrap in `GoogleAnalytics.tsx`,
 * which re-applies a stored `denied` before the first hit fires — too early
 * for a React effect to help.
 */
export const CONSENT_STORAGE_KEY = "satx-ritas-consent";

export type ConsentChoice = "granted" | "denied";

/**
 * The visitor's stored choice, or `null` if they have not chosen yet — which
 * is what the banner keys off. `null` means "running on the granted defaults".
 */
export function getConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Safari private mode throws on localStorage access.
    return null;
  }
}

/** Persist the choice and push it to gtag. Safe to call before gtag loads. */
export function setConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Storage is unavailable; the gtag update below still applies for this
    // page view, the visitor just gets asked again next time.
  }

  window.gtag?.("consent", "update", {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice,
  });
}
