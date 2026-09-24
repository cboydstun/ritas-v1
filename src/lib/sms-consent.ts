/**
 * The SMS opt-in shown on the checkout's details step.
 *
 * The texts it covers are sent by SATX Bounce, not by this site: the two
 * businesses share one depot, one truck and one crew, and every booking is
 * mirrored to bounce-v3, which sends the rental agreement and the delivery
 * confirmation texts from its own number. So the wording names SATX Bounce as
 * the sender, and it must stay identical to the disclosure on satxbounce.com's
 * checkout (`SmsConsentCheckbox.tsx` there) and to the A2P campaign's "How do
 * end-users consent?" field — a carrier reviewer checks the consent shown
 * wherever it was collected.
 *
 * The version is stamped on the rental by the server, never taken from the
 * request, so it always names the copy this build actually rendered. Change it
 * whenever the wording changes.
 */
export const SMS_CONSENT_VERSION = "ritas-2026-09-v1";

export const SMS_CONSENT_SENDER = "SATX Bounce";
