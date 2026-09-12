/**
 * Delivery zone resolution: what a ZIP costs, and whether we go there at all.
 *
 * **Every serviced ZIP carries its own fee.** `Settings.deliveryZones.customFees`
 * is the only price and the only definition of the service area; a ZIP absent
 * from it is not delivered to. Delivery used to be one flat $20 with the service
 * area hardcoded as a 120-entry array compiled into the client bundle, so the
 * price and the area were unrelated facts and neither could change without a
 * deploy.
 *
 * `insideZips` / `outsideZips` are **geography**, not pricing: they decide a
 * label and a colour on the admin map. Membership does not decide, or imply, a
 * fee. Do not reintroduce a fee that a list grants — that is the mistake the
 * per-ZIP map exists to undo.
 */

import type { TierMinimums } from "./tierMinimums";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/site";

export interface DeliveryZoneInfo {
  zone: "inside" | "outside" | "not-supported";
  fee: number;
  message: string;
  displayColor: "green" | "orange" | "red";
}

/** What the admin stores, and what the order form loads into its settings state. */
export interface DeliverySettings {
  /** The fee for every serviced ZIP, keyed by ZIP. Absent key = not serviced. */
  customFees?: Record<string, number>;
  /** Geography only — no price implied. */
  insideZips?: string[];
  /** Geography only — no price implied. */
  outsideZips?: string[];
  /**
   * The minimum order for each fee band (see `./tierMinimums`). Partial, and
   * absent entirely on a settings document written before the field existed;
   * the resolver falls back to the global minimum rather than inventing a ladder.
   */
  tierMinimums?: Partial<TierMinimums>;
}

/**
 * Where a ZIP's fee came from.
 *
 * `"unserviced"` is not a fee of zero — it is the absence of one. Collapsing the
 * two is how a ZIP nobody priced reads as free delivery.
 */
export type ZipFeeSource = "custom" | "unserviced";

export interface ResolvedZipFee {
  /** Dollars, or `null` when the ZIP is not in the service area. */
  fee: number | null;
  source: ZipFeeSource;
}

/** The settings used when the caller supplies none: nothing is serviced. */
function fallbackSettings(): DeliverySettings {
  return { customFees: {}, insideZips: [], outsideZips: [] };
}

/** The five-digit prefix of a ZIP or ZIP+4, with any separator stripped. */
export function fiveDigitZip(zipCode: string): string {
  return zipCode.replace(/\D/g, "").slice(0, 5);
}

/**
 * The ZIP's own fee, read through whichever container `customFees` happens to be.
 *
 * Mongoose stores it as a `Map` of Number. A browser-side caller gets a plain
 * object, because `getPublicSettings` flattens the document first; a server-side
 * caller holding the hydrated document does not, and `fees["78209"]` on a Map is
 * silently `undefined` — which reads as "not serviced" rather than as a bug.
 */
export function customFeeFor(
  settings: DeliverySettings | undefined,
  zip: string,
): number | null {
  const fees: unknown = settings?.customFees;
  if (!fees) return null;

  const value =
    fees instanceof Map
      ? (fees as Map<string, unknown>).get(zip)
      : (fees as Record<string, unknown>)[zip];

  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/**
 * The single fee ladder: the ZIP's own fee, or nothing.
 *
 * Everything else in this file delegates here, so the answer cannot drift
 * between the checkout, the public ZIP checker and the admin map.
 */
export function resolveZipFee(
  zipCode: string,
  settings?: DeliverySettings,
): ResolvedZipFee {
  const zip = zipCode ? fiveDigitZip(zipCode) : "";
  if (zip.length < 5) return { fee: null, source: "unserviced" };

  const fee = customFeeFor(settings ?? fallbackSettings(), zip);

  return fee !== null
    ? { fee, source: "custom" }
    : { fee: null, source: "unserviced" };
}

/** Is this ZIP on the inside-zone list? Geography, not a price. */
export function isInsideZone(zipCode: string, insideZips?: string[]): boolean {
  if (!zipCode || !insideZips?.length) return false;
  return insideZips.includes(fiveDigitZip(zipCode));
}

/** Is this ZIP on the outside-zone list? Geography, not a price. */
export function isOutsideZone(
  zipCode: string,
  outsideZips?: string[],
): boolean {
  if (!zipCode || !outsideZips?.length) return false;
  return outsideZips.includes(fiveDigitZip(zipCode));
}

/**
 * The delivery fee for a ZIP.
 *
 * A ZIP with no fee of its own is not in the service area, and `isServicedZipCode`
 * refuses it before this is reached. The `?? 0` is what that refusal costs if it
 * is ever bypassed — kept deliberately, because the alternative is a `NaN`
 * propagating into an order total. **It is not the gate.**
 */
export function getDeliveryFee(
  zipCode: string,
  settings?: DeliverySettings,
): number {
  return resolveZipFee(zipCode, settings).fee ?? 0;
}

/** Everything the customer-facing surfaces need to say about a ZIP. */
export function getDeliveryZoneInfo(
  zipCode: string,
  settings?: DeliverySettings,
): DeliveryZoneInfo {
  const zip = zipCode ? fiveDigitZip(zipCode) : "";
  if (zip.length < 5) {
    return {
      zone: "not-supported",
      fee: 0,
      message: "Please enter a valid ZIP code",
      displayColor: "red",
    };
  }

  const fees = settings ?? fallbackSettings();
  const resolved = resolveZipFee(zip, fees);

  if (resolved.source === "custom") {
    const fee = resolved.fee as number;
    // The zone describes where the customer is, not where the fee came from: a
    // priced ZIP on neither list reports "outside".
    const inside = isInsideZone(zip, fees.insideZips);

    return {
      zone: inside ? "inside" : "outside",
      fee,
      message:
        fee === 0
          ? `No distance surcharge for ${zip}`
          : `$${fee} distance surcharge for ${zip}`,
      displayColor: fee === 0 ? "green" : "orange",
    };
  }

  return {
    zone: "not-supported",
    fee: 0,
    message: `We don't have a delivery price set for ${zip} yet. Call us at ${BUSINESS_PHONE_DISPLAY} and we'll see what we can do.`,
    displayColor: "red",
  };
}
