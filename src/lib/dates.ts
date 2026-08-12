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
