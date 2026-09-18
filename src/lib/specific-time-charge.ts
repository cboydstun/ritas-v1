/**
 * The specific-time surcharge, in one place.
 *
 * Ported from bounce-v3's `src/lib/orders/specificTimeCharge.ts`. The two
 * businesses share one depot, one truck and one crew, and a customer who pins
 * delivery or pickup to a clock time fixes a point in that crew's day that a
 * flexible booking leaves free. bounce-v3 charges for it; this is the same
 * rule.
 *
 * **Every leg carries a preferred clock time and a stored preference**
 * (`rentalTimePreference` / `returnTimePreference`), the same shape bounce-v3
 * stores. A flexible delivery arrives at or before the preferred time and a
 * flexible pickup happens at or after it, so the customer has the machine for
 * the whole party either way; a specific leg arrives at exactly that time and
 * is what is charged. The charge itself is never stored: `computeOrderTotal`
 * recomputes it from the preferences and the `Settings.fees` figures, which is
 * what keeps the browser, `createBooking`, the email and the partner payload
 * from quoting four different numbers.
 *
 * **Legacy orders** predate the preference field and stored a flexible leg as
 * the time `"ANY"`. `legPreference()` is the one place that reads them: with no
 * stored preference, `"ANY"` is flexible and a clock time is specific — exactly
 * how they were priced when they were sold.
 *
 * bounce-v3's location-type lock and its school/church waiver are deliberately
 * not ported — this app records no location type.
 *
 * Zod-free and mongoose-free on purpose: the order form imports it.
 */

/** What a pinned leg costs when `Settings.fees` carries no figure. */
export const DEFAULT_SPECIFIC_TIME_FEE = 25;

/**
 * The value a flexible leg was stored as before preferences were stored.
 * Legacy reads only — nothing writes it any more.
 */
export const FLEXIBLE_TIME = "ANY";

export const TIME_PREFERENCES = ["flexible", "specific"] as const;

export type TimePreference = (typeof TIME_PREFERENCES)[number];

export function isTimePreference(value: unknown): value is TimePreference {
  return value === "flexible" || value === "specific";
}

/**
 * How firm a leg is. The stored preference when there is one; otherwise the
 * legacy derivation from the time itself.
 *
 * An empty time with no preference is flexible, not specific: an empty one
 * only exists mid-form, and a sidebar total must not bill a leg the customer
 * has not chosen yet.
 */
export function legPreference(
  time: string | undefined | null,
  preference: string | undefined | null,
): TimePreference {
  if (isTimePreference(preference)) return preference;
  return !!time && time !== FLEXIBLE_TIME ? "specific" : "flexible";
}

export interface SpecificTimeChargeInput {
  rentalTime: string | undefined | null;
  returnTime: string | undefined | null;
  /**
   * Required keys, even though the value may be absent (a legacy order). Every
   * caller has to say something, so none can silently bill a pinned leg at $0
   * — the trap the times themselves fell into once.
   */
  rentalTimePreference: TimePreference | undefined | null;
  returnTimePreference: TimePreference | undefined | null;
  specificDeliveryTimeFee: number;
  specificPickupTimeFee: number;
}

/**
 * What this order owes for its pinned times: each leg's fee, summed.
 *
 * The fees are supplied by the caller rather than defaulted here, the same
 * choice bounce-v3 makes — every caller already holds the settings figures,
 * and a default inside this function would hide a read that returned nothing.
 */
export function resolveSpecificTimeCharge({
  rentalTime,
  returnTime,
  rentalTimePreference,
  returnTimePreference,
  specificDeliveryTimeFee,
  specificPickupTimeFee,
}: SpecificTimeChargeInput): number {
  return (
    (legPreference(rentalTime, rentalTimePreference) === "specific"
      ? specificDeliveryTimeFee
      : 0) +
    (legPreference(returnTime, returnTimePreference) === "specific"
      ? specificPickupTimeFee
      : 0)
  );
}

/** How a leg's fee is named in copy. Keyed on the number, never on a type. */
export function specificTimeFeeNote(fee: number): string {
  if (!(fee > 0)) return "No charge";
  return Number.isInteger(fee) ? `+$${fee}` : `+$${fee.toFixed(2)}`;
}

/**
 * "14:00" → "2:00 PM". A legacy order's "ANY" sentinel reads "Any Time"; the
 * old formatter fed it to parseInt and rendered the nonsense "12:undefined AM"
 * in every operator SMS.
 */
export function formatDeliveryTime(time: string): string {
  if (!time || time === FLEXIBLE_TIME) return "Any Time";

  const [hourPart, minutePart] = time.split(":");
  const hour24 = parseInt(hourPart, 10);
  if (!Number.isFinite(hour24) || !minutePart) return "Any Time";

  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutePart} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/**
 * A leg as the customer and the crew should read it: "by 2:00 PM" for a
 * flexible delivery (at or before), "from 2:00 PM" for a flexible pickup (at or
 * after), "at 2:00 PM" for a specific one. A legacy "ANY" leg reads "Any Time".
 */
export function formatLegTime(
  leg: "delivery" | "pickup",
  time: string | undefined | null,
  preference: string | undefined | null,
): string {
  const clock = formatDeliveryTime(time ?? "");
  if (clock === "Any Time") return clock;
  if (legPreference(time, preference) === "specific") return `at ${clock}`;
  return leg === "delivery" ? `by ${clock}` : `from ${clock}`;
}
