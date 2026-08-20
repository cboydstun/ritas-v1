/**
 * Hashed customer identifiers for Google Ads enhanced conversions.
 *
 * Enhanced conversions raise the match rate on browsers that drop the
 * conversion cookie — Safari and iOS most of all — by letting Google match the
 * click to a first-party identifier the advertiser already holds. The
 * identifier must be SHA-256 hashed, and this module is the only place in the
 * app that produces one.
 *
 * Everything here runs in the browser and hashes *before* the value reaches
 * `window.dataLayer`, so a raw email or phone number never enters the tag
 * layer, is never visible to a GTM preview session, and cannot be read back by
 * any container tag. The rest of the codebase's rule — that customer contact
 * details do not go to analytics — is unchanged: a SHA-256 digest is not a
 * contact detail.
 *
 * Normalisation follows Google's specification exactly. It has to: Google
 * hashes its own copy the same way and compares digests, so a difference of
 * one space or one capital letter is not a worse match, it is no match at all.
 */

import { getConsent } from "./consent";

/** What Google Ads expects on the `user_data` key of a conversion. */
export interface HashedUserData {
  sha256_email_address?: string;
  sha256_phone_number?: string;
}

/**
 * Google's rule for email: strip surrounding whitespace, lowercase. Nothing
 * else — in particular do not strip Gmail dots here, because Google's own
 * normalisation of the address it holds does not, and the digests would differ.
 */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Google's rule for phone: E.164, so digits only with a country code prefixed.
 * Every number this app accepts is validated as US/Bexar County, so a bare
 * 10-digit number gets +1. Anything that does not resolve to a plausible E.164
 * string is dropped rather than guessed at — a wrong digest is indistinguishable
 * from no digest to Google, but it costs a round trip and muddies debugging.
 */
function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash whatever identifiers are present, or return `undefined`.
 *
 * `undefined` on any failure is deliberate and load-bearing. This is called
 * from the booking submit handler, after the booking has already been written,
 * and the customer's redirect depends on getting past it. `crypto.subtle` is
 * unavailable on insecure origins, so it is simply absent in some development
 * setups; a throw there would surface to the customer as "Failed to confirm
 * booking" for a booking that in fact succeeded.
 *
 * A stored consent denial also returns `undefined`: enhanced conversions are
 * advertising data, and the banner promises the opt-out is honoured. Google
 * Consent Mode would suppress the tag anyway, but not sending the digest at
 * all is the honest version of that promise.
 */
export async function hashUserData(customer: {
  email?: string;
  phone?: string;
}): Promise<HashedUserData | undefined> {
  if (typeof window === "undefined") return undefined;
  if (getConsent() === "denied") return undefined;
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;

  try {
    const userData: HashedUserData = {};

    const email = customer.email ? normaliseEmail(customer.email) : "";
    if (email) userData.sha256_email_address = await sha256Hex(email);

    const phone = customer.phone ? normalisePhone(customer.phone) : null;
    if (phone) userData.sha256_phone_number = await sha256Hex(phone);

    return Object.keys(userData).length > 0 ? userData : undefined;
  } catch {
    return undefined;
  }
}
