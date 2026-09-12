/**
 * What an order pays to be delivered.
 *
 * There are two terms, and they answer different questions:
 *
 *   - the **distance surcharge** — the ZIP's own figure in
 *     `Settings.deliveryZones.customFees`, or no service at all
 *     (`resolveZipFee`). It prices how far the truck drives;
 *   - the **base delivery fee** — `Settings.deliveryZones.baseFee`, $20. It
 *     prices the truck, the two people and the round trip, which every order
 *     buys regardless of distance.
 *
 * **Why the second term exists.** The per-ZIP table was adopted wholesale from
 * bounce-v3, which delivers out of the same depot and had tuned it ZIP by ZIP
 * against real routes. But 25 of its central San Antonio ZIPs are priced at
 * $0, and in bounce-v3 that $0 is the absence of a *surcharge*, not free
 * delivery — it is survivable there because a bounce-house order already
 * carries the delivery economics. Copied here without that second term it
 * meant a machine to Alamo Heights bought a truck, two people and a round trip
 * for nothing, having charged a flat $20 for the same trip the day before.
 * bounce-v3 reached the same conclusion about its own table and added exactly
 * this field (`72fcdb813`, 2026-09-12).
 *
 * **There is no waiver here, and that is the point.** bounce-v3 waives the base
 * fee when the cart contains an inflatable. SATX Ritas rents frozen drink
 * machines and nothing else, so in bounce-v3's terms every order this business
 * takes is a no-inflatable order — the branch that always pays. Expressing a
 * waiver with nothing that could ever satisfy it would be dead code pretending
 * to be policy.
 *
 * **This module is the only place the rule lives.** The browser and the server
 * must reach the same answer, and nothing downstream would catch them if they
 * did not: `/api/save-booking` recomputes the whole total with
 * `computeOrderTotal`, so a server-side charge the review screen never showed
 * is simply billed. Re-deriving the sum on either side is what would reopen
 * that gap.
 */

import { roundCurrency } from "@/lib/money";

/**
 * The base fee when the settings document carries none.
 *
 * A schema default on `Settings.deliveryZones.baseFee` rather than a seeded
 * value: it is one scalar with one correct answer for every settings document,
 * so unlike `tierMinimums` — a per-band policy decision that had to exist in
 * the stored document — there is nothing to seed and nothing to migrate. A
 * document written before the field existed reads the current price.
 *
 * $20 is what this business charged for delivery, flat, before per-ZIP pricing
 * shipped, and it is what `fees.deliveryFee` still defaults to.
 */
export const DEFAULT_BASE_DELIVERY_FEE = 20;

export interface DeliveryCharge {
  /** The flat fee every order pays. */
  baseFee: number;
  /** The ZIP's own fee. Zero is a real answer; absent is refused upstream. */
  distanceSurcharge: number;
  /** What `computeOrderTotal` bills and the review screen shows. */
  total: number;
}

/**
 * The two terms, and what they add up to.
 *
 * Passing an unserviced ZIP's absence of a fee is the caller's problem, not
 * this function's — `resolveDeliveryFee` refuses that before it gets here, and
 * `getDeliveryFee`'s `?? 0` exists only to keep a NaN out of a total if the
 * gate is ever bypassed.
 */
export function deliveryChargeFor({
  distanceSurcharge,
  baseFee,
}: {
  distanceSurcharge: number;
  baseFee: number | undefined;
}): DeliveryCharge {
  const surcharge = roundCurrency(distanceSurcharge || 0);
  const base = roundCurrency(Math.max(0, baseFee ?? DEFAULT_BASE_DELIVERY_FEE));

  return {
    baseFee: base,
    distanceSurcharge: surcharge,
    total: roundCurrency(surcharge + base),
  };
}

/** The zero charge, for a checkout that has no ZIP yet. */
export const NO_DELIVERY_CHARGE: DeliveryCharge = {
  baseFee: 0,
  distanceSurcharge: 0,
  total: 0,
};
