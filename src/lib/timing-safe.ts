import { timingSafeEqual } from "crypto";

/**
 * Length-independent constant-time string comparison.
 *
 * Shared by the admin credentials check and the cron-secret check so neither
 * leaks its secret's length or a common prefix through response timing.
 */
export function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, so a differing length short
  // circuits — still burning a comparison so the failure path costs the same.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
