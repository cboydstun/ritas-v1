/**
 * The minimum order a ZIP carries, derived from what that ZIP costs to deliver to.
 *
 * `customFees` gives every serviced ZIP its own fee and `bucketForFee` sorts
 * those fees into five bands; the minimum rides on the band. A $110 booking is
 * fine at $0 delivery and is a loss at $75.
 *
 * Deliberately **not** a second per-ZIP map. A floor read off the ZIP's own
 * dollar figure cannot drift from what that ZIP is priced at, and it moves the
 * moment the fee does — setting a ZIP's fee sets its minimum in the same act.
 *
 * **`DEFAULT_TIER_MINIMUMS` is all zeros, and that is a decision, not a stub.**
 * bounce-v3 shipped a 100/200/300/400/500 ladder as a schema default; it became
 * production policy by accident and, measured against the preceding twelve
 * months, refused 174 of 572 orders — 30% of the business, against floors nobody
 * had measured. SATX Ritas has never measured one. Zero means "no floor", the
 * engine stays inert until an admin types a number, and there is nothing to
 * un-refuse. Raise these in the admin, never here.
 */

import { bucketForFee, type FeeBucketId } from "./feeBuckets";
import { customFeeFor, fiveDigitZip, type DeliverySettings } from "./zones";

/** Every bucket that is an actual price. `unserviced` is the absence of one. */
export type PricedFeeBucketId = Exclude<FeeBucketId, "unserviced">;

export type TierMinimums = Record<PricedFeeBucketId, number>;

export const DEFAULT_TIER_MINIMUMS = {
  free: 0,
  low: 0,
  standard: 0,
  high: 0,
  premium: 0,
} satisfies TierMinimums;

/** Ladder order — the fee legend's order, minus `unserviced`. */
export const TIER_MINIMUM_ORDER: PricedFeeBucketId[] = [
  "free",
  "low",
  "standard",
  "high",
  "premium",
];

export function isPricedBucket(id: FeeBucketId): id is PricedFeeBucketId {
  return id !== "unserviced";
}

/**
 * The minimum for a fee, or `fallback` when no tier covers it.
 *
 * **Absent configuration falls back to the caller's number, never to
 * `DEFAULT_TIER_MINIMUMS`.** The defaults belong to the schema; a settings
 * object that has never carried `tierMinimums` — a test fixture, a document
 * written before the field existed — must keep behaving the way it did when the
 * only minimum was the global one.
 *
 * A configured `0` is a real setting and is honoured, which is why this tests
 * `typeof` rather than truthiness.
 */
export function minimumForFee(
  fee: number | null | undefined,
  tierMinimums: Partial<TierMinimums> | undefined,
  fallback: number,
): number {
  const bucket = bucketForFee(fee);
  if (!isPricedBucket(bucket.id)) return fallback;

  const configured = tierMinimums?.[bucket.id];
  return typeof configured === "number" ? configured : fallback;
}

/**
 * The minimum for a ZIP: its own fee's tier, or `fallback` when the ZIP is not
 * serviced — which is also what an empty ZIP box resolves to, so the checkout
 * has an answer before the customer has typed one.
 */
export function minimumForZip(
  zipCode: string | undefined,
  settings: DeliverySettings | undefined,
  fallback: number,
): number {
  const zip = zipCode ? fiveDigitZip(zipCode) : "";
  const fee = zip.length >= 5 ? customFeeFor(settings, zip) : null;

  return minimumForFee(fee, settings?.tierMinimums, fallback);
}

/** `$200`, or `$199.50` when the admin has set something that is not round. */
export function formatMinimum(minimum: number): string {
  return Number.isInteger(minimum) ? `$${minimum}` : `$${minimum.toFixed(2)}`;
}

/**
 * The advisory line, shown beside the distance surcharge as soon as the ZIP is
 * known. Shared by the checkout notice and the public ZIP checker so the two
 * cannot quote different floors for the same ZIP.
 */
export function minimumOrderNotice(minimum: number): string {
  return `Orders to this area have a ${formatMinimum(minimum)} rental minimum, before the distance surcharge and fees.`;
}

/**
 * The refusal. Shared by the review step and the server route: a customer told
 * one number on screen and another by the API has been told nothing.
 */
export function minimumOrderError(
  minimum: number,
  zipCode: string | undefined,
  rentalSubtotal?: number,
): string {
  const where = zipCode ? `Orders to ${fiveDigitZip(zipCode)}` : "Orders";
  const have = `${where} have a ${formatMinimum(minimum)} rental minimum, before the distance surcharge and fees.`;

  return rentalSubtotal === undefined
    ? have
    : `${have} Your rentals come to $${rentalSubtotal.toFixed(2)}.`;
}
