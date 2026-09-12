"use client";

import {
  getDeliveryZoneInfo,
  type DeliverySettings,
} from "@/lib/delivery/zones";
import { minimumForZip, minimumOrderNotice } from "@/lib/delivery/tierMinimums";

interface Props {
  zipCode: string;
  zones?: DeliverySettings;
  /** `Settings.fees.minOrderAmount` — what a ZIP with no band falls back to. */
  fallbackMinimum?: number;
}

/**
 * What this ZIP costs to deliver to, shown under the ZIP field as soon as it is
 * known — rather than as a surprise line on the review screen.
 *
 * Reads the same `getDeliveryZoneInfo` the server prices from, so the notice
 * and the invoice cannot disagree.
 */
export default function DeliveryFeeNotice({
  zipCode,
  zones,
  fallbackMinimum = 0,
}: Props) {
  if (!zipCode || zipCode.replace(/\D/g, "").length < 5) return null;

  const info = getDeliveryZoneInfo(zipCode, zones);
  const minimum = minimumForZip(zipCode, zones, fallbackMinimum);

  if (info.zone === "not-supported") {
    return (
      <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
        {info.message}
      </p>
    );
  }

  // Keyed on the fee, not on the zone: a ZIP on the outside list can be free
  // and one on the inside list can carry a surcharge. Membership is geography.
  const free = info.fee === 0;

  return (
    <div
      className={`mt-2 rounded-lg p-3 text-sm ${
        free
          ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
          : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      }`}
    >
      <p className="font-medium">
        {free
          ? "No distance surcharge for your ZIP"
          : `$${info.fee} distance surcharge for your ZIP`}
      </p>
      {!free && (
        <p className="mt-1">
          Added to your total, and itemised on the review step before you book.
        </p>
      )}
      {minimum > 0 && <p className="mt-1">{minimumOrderNotice(minimum)}</p>}
    </div>
  );
}
