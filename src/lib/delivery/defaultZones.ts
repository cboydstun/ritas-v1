/**
 * The ZIP lists a brand-new settings document starts with.
 *
 * **Seed-only.** Runtime always reads `Settings.deliveryZones` from Mongo; these
 * constants exist so a fresh database is not born with an empty service area,
 * and so the seed script has one list to copy.
 *
 * The membership is exactly what the old hardcoded `isBexarCountyZipCode`
 * accepted, split by geography: the 78201-78299 San Antonio block is "inside",
 * the outlying Bexar-and-adjacent ZIPs are "outside". Neither list implies a
 * price — `customFees` is the only price there is.
 */

/**
 * 78201 through 78299.
 *
 * Generated rather than listed, but pinned by `__tests__/defaultZones.test.ts`
 * at both ends: the previous generator ran `i = 0` for 99 entries and produced
 * 78200-78298, which turned away the real ZIP 78299 and accepted the unassigned
 * 78200. An off-by-one here is invisible until a customer is refused.
 */
export const DEFAULT_INSIDE_ZIPS: string[] = Array.from(
  { length: 99 },
  (_, i) => `782${String(i + 1).padStart(2, "0")}`,
);

/** Outlying Bexar County and immediately adjacent ZIPs. */
export const DEFAULT_OUTSIDE_ZIPS: string[] = [
  "78002",
  "78006",
  "78009",
  "78015",
  "78023",
  "78039",
  "78052",
  "78054",
  "78056",
  "78069",
  "78073",
  "78101",
  "78108",
  "78109",
  "78112",
  "78124",
  "78148",
  "78150",
  "78152",
  "78154",
  "78163",
];

/** Every ZIP the seed prices, in one list. */
export const DEFAULT_SERVICED_ZIPS: string[] = [
  ...DEFAULT_INSIDE_ZIPS,
  ...DEFAULT_OUTSIDE_ZIPS,
];

/**
 * What each seeded ZIP costs on day one.
 *
 * The flat fee this system replaces. Seeding at the current figure means the
 * cutover changes no customer's price; retuning happens afterwards, in the
 * admin, one ZIP at a time.
 */
export const SEED_FLAT_FEE = 20;
