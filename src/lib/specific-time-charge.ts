/**
 * The specific-time surcharge, in one place.
 *
 * Ported from bounce-v3's `src/lib/orders/specificTimeCharge.ts`. The two
 * businesses share one depot, one truck and one crew, and a customer who pins
 * delivery or pickup to a clock time fixes a point in that crew's day that a
 * flexible booking leaves free. bounce-v3 charges for it; this is the same
 * rule.
 *
 * **There is no stored preference field.** A flexible leg has always been
 * written as the time `"ANY"` (`timeStringSchema` in `validation.ts`), so the
 * preference is derived from the value, and the charge is derived from the
 * preference. Nothing about it is stored: `computeOrderTotal` recomputes it
 * from `rentalTime` / `returnTime` and the `Settings.fees` figures, which is
 * what keeps the browser, `createBooking`, the email and the partner payload
 * from quoting four different numbers.
 *
 * bounce-v3's location-type lock and its school/church waiver are deliberately
 * not ported — this app records no location type.
 *
 * Zod-free and mongoose-free on purpose: the order form imports it.
 */

/** What a pinned leg costs when `Settings.fees` carries no figure. */
export const DEFAULT_SPECIFIC_TIME_FEE = 25;

/** The value a flexible leg is stored as. */
export const FLEXIBLE_TIME = "ANY";

/**
 * Whether a stored time pins the leg to the clock.
 *
 * An empty value is flexible, not specific: the wizard refuses to advance
 * without a time, so an empty one only exists mid-form, and a sidebar total
 * must not bill a leg the customer has not chosen yet.
 */
export function isSpecificTime(time: string | undefined | null): boolean {
  return !!time && time !== FLEXIBLE_TIME;
}

export interface SpecificTimeChargeInput {
  rentalTime: string | undefined | null;
  returnTime: string | undefined | null;
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
  specificDeliveryTimeFee,
  specificPickupTimeFee,
}: SpecificTimeChargeInput): number {
  return (
    (isSpecificTime(rentalTime) ? specificDeliveryTimeFee : 0) +
    (isSpecificTime(returnTime) ? specificPickupTimeFee : 0)
  );
}

/** How a leg's fee is named in copy. Keyed on the number, never on a type. */
export function specificTimeFeeNote(fee: number): string {
  if (!(fee > 0)) return "No charge";
  return Number.isInteger(fee) ? `+$${fee}` : `+$${fee.toFixed(2)}`;
}

/**
 * "14:00" → "2:00 PM". The delivery-window picker defaults to the "ANY"
 * sentinel, which the old formatter fed to parseInt and rendered as the
 * nonsense "12:undefined AM" in every operator SMS.
 */
export function formatDeliveryTime(time: string): string {
  if (!time || time === FLEXIBLE_TIME) return "Any Time";

  const [hourPart, minutePart] = time.split(":");
  const hour24 = parseInt(hourPart, 10);
  if (!Number.isFinite(hour24) || !minutePart) return "Any Time";

  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutePart} ${hour24 >= 12 ? "PM" : "AM"}`;
}
