/**
 * Date helpers shared by the server routes and the browser bundle.
 *
 * These live outside `src/lib/validation.ts` so a client component can import
 * them without pulling zod (and every request schema) into the order-form
 * bundle. `validation.ts` re-exports them, so server code can keep importing
 * from either place.
 */

export const BUSINESS_TIME_ZONE = "America/Chicago";

/**
 * Today in the business's timezone as YYYY-MM-DD.
 *
 * Deliberately not the server clock: Vercel functions run UTC, so after 19:00
 * Central the server was already on tomorrow's date and rejected same-day
 * bookings that the client's date picker had just offered. `en-CA` formats as
 * YYYY-MM-DD, which is the format used throughout this codebase.
 */
export function todayLocalIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Whole days between two YYYY-MM-DD strings, diffed as UTC calendar dates.
 *
 * Differencing local-midnight timestamps is wrong across a DST boundary: in
 * America/Chicago, 2025-11-02 → 2025-11-03 is 25 hours, which a ceil() of the
 * millisecond difference reports as 2 days — billing a one-night rental twice.
 * Normalising to UTC keeps every day exactly 24 hours.
 *
 * This lived in both `validation.ts` (as `spanInDays`) and
 * `components/order/utils.ts` (inside `calculateRentalDays`), identical apart
 * from the latter's `Math.max(1, …)` clamp — so the DST fix above was one edit
 * away from regressing in the copy that did not carry the comment.
 */
export function spanInDays(start: string, end: string): number {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
}

/**
 * Field patterns shared by the browser and the zod request schemas.
 *
 * The client reimplemented these in `components/order/utils.ts`. Phone and ZIP
 * were character-identical duplicates, but email diverged — the client used
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` while the server used zod's `.email()`, so a
 * value could pass every step of the wizard and be rejected at submit.
 */
export const PHONE_PATTERN = /^\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$/;
export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
/**
 * Mirrors zod's own `.email()`: no leading dot, no consecutive dots, and a
 * real TLD. The server validates with this same constant rather than
 * `.email()`, so the two sides agree by construction rather than by
 * resemblance. This module must stay zod-free — importing zod here would put
 * every request schema into the order-form bundle.
 */
export const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
