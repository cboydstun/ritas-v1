/**
 * The one rounding rule for money in this app.
 *
 * It lives here rather than in `components/order/utils.ts` because
 * `lib/delivery/deliveryCharge.ts` needs it too, and that module cannot import
 * from `components/order/utils.ts` — `utils.ts` already imports
 * `lib/delivery/zones.ts`, so the dependency would be a cycle. Re-declaring it
 * on the other side of the cycle is the alternative, and a second copy of a
 * money function is exactly the shape `calculateRentalDays` was in when one of
 * its two copies carried the DST bug and the other did not.
 */

/**
 * Round a currency amount to cents, decimal half-up.
 *
 * `Number(x.toFixed(2))` rounds the *binary* double, so a value that is an
 * exact half-cent in decimal can round down: 489.50 * 0.03 is 14.685 in
 * decimal but 14.684999999999999 as a double, and toFixed(2) yields 14.68
 * rather than 14.69. That underbilled the processing fee by a cent and
 * cascaded into salesTax and finalTotal, leaving the stored price, the
 * confirmation email and the QuickBooks invoice (which rounds decimal
 * half-up) disagreeing. Adding one ULP before scaling restores half-up.
 */
export const roundCurrency = (amount: number): number =>
  Math.round(Number((amount * 100).toPrecision(12))) / 100;
