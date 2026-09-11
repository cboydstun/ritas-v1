/**
 * Turns the delivery settings into one row per configured ZIP for the admin page.
 *
 * This lives outside the map component on purpose: `GoogleDeliveryZoneMap` loads
 * the Maps SDK, so nothing in that file can be unit tested. The rows are pure
 * data; the map merges boundary geometry onto them at render time.
 *
 * The row set is derived from the **settings alone** — `customFees` plus both
 * zone lists — never from the boundary file. A static snapshot of which ZIPs
 * exist is not a statement about which ones we deliver to, and in bounce-v3 the
 * two disagreed for five ZIPs while the map showed the wrong fee for each.
 */

import { resolveZipFee, type DeliverySettings } from "./zones";
import { bucketForFee, type FeeBucket } from "./feeBuckets";

export interface ZipFeeRow {
  zipCode: string;
  /** Dollars, or `null` when the ZIP has no fee of its own — i.e. unserviced. */
  fee: number | null;
  bucket: FeeBucket;
}

/**
 * Every ZIP the admin has configured: both zone lists plus everything carrying a
 * fee.
 *
 * A priced ZIP is serviced whether or not it is on a list, and a listed ZIP with
 * no fee is *not* serviced — but it still has to appear here, or the admin
 * cannot see the gap, let alone click it to close it.
 */
export function configuredZipCodes(settings: DeliverySettings): string[] {
  const fees = settings.customFees;
  const priced =
    fees instanceof Map
      ? Array.from((fees as Map<string, number>).keys())
      : Object.keys(fees ?? {});

  return Array.from(
    new Set([
      ...(settings.insideZips ?? []),
      ...(settings.outsideZips ?? []),
      ...priced,
    ]),
  ).sort();
}

/** One row per configured ZIP, ascending. */
export function buildZipFeeRows(settings: DeliverySettings): ZipFeeRow[] {
  return configuredZipCodes(settings).map((zipCode) => {
    const resolved = resolveZipFee(zipCode, settings);
    return {
      zipCode,
      fee: resolved.fee,
      bucket: bucketForFee(resolved.fee),
    };
  });
}

/** The bands actually in use, for a legend that does not list empty ones. */
export function bucketsInUse(rows: ZipFeeRow[]): Set<FeeBucket["id"]> {
  return new Set(rows.map((row) => row.bucket.id));
}

/** How many configured ZIPs sit in each band. */
export function countByBucket(rows: ZipFeeRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.bucket.id] = (counts[row.bucket.id] ?? 0) + 1;
    return counts;
  }, {});
}
