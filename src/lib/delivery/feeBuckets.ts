/**
 * Colour bands for the admin delivery-zone map.
 *
 * Delivery used to be one flat `Settings.fees.deliveryFee`, so there was nothing
 * to paint: every serviced ZIP cost the same. Now that each ZIP carries its own
 * figure the colour has to come from the dollar amount.
 *
 * Edges are inclusive at the top: $50 is "standard", $50.01 is "high".
 */

export type FeeBucketId =
  "free" | "low" | "standard" | "high" | "premium" | "unserviced";

export interface FeeBucket {
  id: FeeBucketId;
  /** Legend label. */
  label: string;
  /** Legend range description. */
  range: string;
  /** Polygon fill colour. */
  fill: string;
  /** Polygon stroke colour. */
  stroke: string;
}

/**
 * Keyed by id and constrained with `satisfies`, so a new bucket id cannot join
 * the union without a colour. These are hex strings on purpose — they are handed
 * to the Google Maps SDK, which cannot read a Tailwind class.
 */
export const FEE_BUCKETS = {
  free: {
    id: "free",
    label: "Free",
    range: "$0",
    fill: "#10B981",
    stroke: "#059669",
  },
  low: {
    id: "low",
    label: "Low",
    range: "$0.01 – $25",
    fill: "#84CC16",
    stroke: "#65A30D",
  },
  standard: {
    id: "standard",
    label: "Standard",
    range: "$25.01 – $50",
    fill: "#F59E0B",
    stroke: "#D97706",
  },
  high: {
    id: "high",
    label: "High",
    range: "$50.01 – $100",
    fill: "#F97316",
    stroke: "#EA580C",
  },
  premium: {
    id: "premium",
    label: "Premium",
    range: "Over $100",
    fill: "#EF4444",
    stroke: "#DC2626",
  },
  unserviced: {
    id: "unserviced",
    label: "Not serviced",
    range: "No fee configured",
    fill: "#9CA3AF",
    stroke: "#6B7280",
  },
} satisfies Record<FeeBucketId, FeeBucket>;

/** Legend order — the dollar scale, with "not serviced" last because it is not on it. */
export const FEE_BUCKET_ORDER: FeeBucketId[] = [
  "free",
  "low",
  "standard",
  "high",
  "premium",
  "unserviced",
];

/**
 * The bucket a fee falls in.
 *
 * `null` means the ZIP has no fee at all — nobody priced it — which is a
 * different thing from free delivery and must not be painted as one.
 */
export function bucketForFee(fee: number | null | undefined): FeeBucket {
  if (fee === null || fee === undefined || Number.isNaN(fee)) {
    return FEE_BUCKETS.unserviced;
  }
  if (fee <= 0) return FEE_BUCKETS.free;
  if (fee <= 25) return FEE_BUCKETS.low;
  if (fee <= 50) return FEE_BUCKETS.standard;
  if (fee <= 100) return FEE_BUCKETS.high;
  return FEE_BUCKETS.premium;
}
