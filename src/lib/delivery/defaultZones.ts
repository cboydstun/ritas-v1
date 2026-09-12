/**
 * The service area a brand-new settings document starts with.
 *
 * **Seed-only.** Runtime always reads `Settings.deliveryZones` from Mongo; these
 * constants exist so a fresh database is not born with an empty service area,
 * and so the seed script has one list to copy.
 *
 * The membership and the prices are a point-in-time copy of bounce-v3's
 * production `Settings.deliveryZones` — the two businesses deliver out of the
 * same depot, and bounce-v3's table is the one that has been tuned ZIP by ZIP
 * against real routes. `zone-snapshot.json` carries the copy and its provenance;
 * this module is only the typed view of it. Nothing syncs: a fee retuned in
 * bounce-v3 does not reach here.
 *
 * Neither list implies a price — `customFees` is the only price there is, and a
 * ZIP absent from it is refused at checkout however it is listed.
 */

import snapshot from "./zone-snapshot.json";

/**
 * Inside Loop 1604. Geography, not a price.
 *
 * This used to be `78201`-`78299` generated in a loop, which listed 32 ZIPs that
 * are PO-box or unassigned — no polygon, no residents, no route. The snapshot
 * lists the ones actually delivered to.
 */
export const DEFAULT_INSIDE_ZIPS: string[] = snapshot.insideZips;

/** Outlying Bexar County and immediately adjacent ZIPs. Geography, not a price. */
export const DEFAULT_OUTSIDE_ZIPS: string[] = snapshot.outsideZips;

/** Every ZIP the seed prices, in one list. */
export const DEFAULT_SERVICED_ZIPS: string[] = [
  ...DEFAULT_INSIDE_ZIPS,
  ...DEFAULT_OUTSIDE_ZIPS,
];

/**
 * What each seeded ZIP costs, keyed by ZIP.
 *
 * Every ZIP on either list carries an entry here and nothing else does, which is
 * what `__tests__/defaultZones.test.ts` pins: a listed ZIP with no fee looks
 * covered on the map and is refused at checkout, and a priced ZIP on no list is
 * serviced without appearing in either zone's copy.
 */
export const DEFAULT_ZIP_FEES: Record<string, number> = snapshot.customFees;
