"use client";

import {
  getDeliveryZoneInfo,
  type DeliverySettings,
} from "@/lib/delivery/zones";
import { minimumForZip, minimumOrderNotice } from "@/lib/delivery/tierMinimums";
import { deliveryChargeFor } from "@/lib/delivery/deliveryCharge";
import { formatPrice } from "@/lib/pricing";

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
 * Reads the same `getDeliveryZoneInfo` and the same `deliveryChargeFor` the
 * server prices from, so the notice and the invoice cannot disagree. It names
 * **both** terms, because naming only the surcharge is how a ZIP priced at $0
 * came to read as free delivery — the failure this notice exists to prevent.
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

  // Keyed on the fee, not on the zone: a ZIP on the outside list can carry no
  // surcharge and one on the inside list can carry one. Membership is geography.
  const charge = deliveryChargeFor({
    distanceSurcharge: info.fee,
    baseFee: zones?.baseFee,
  });
  const noSurcharge = charge.distanceSurcharge === 0;

  return (
    <div
      className={`mt-2 rounded-lg p-3 text-sm ${
        noSurcharge
          ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
          : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      }`}
    >
      <p className="font-medium">
        Delivery to your ZIP: ${formatPrice(charge.total)}
      </p>
      <p className="mt-1">
        {noSurcharge
          ? `$${formatPrice(charge.baseFee)} delivery and setup, with no distance surcharge for your ZIP.`
          : `$${formatPrice(charge.baseFee)} delivery and setup, plus a $${formatPrice(charge.distanceSurcharge)} distance surcharge for your ZIP.`}
      </p>
      <p className="mt-1">Itemised on the review step before you book.</p>
      {minimum > 0 && <p className="mt-1">{minimumOrderNotice(minimum)}</p>}
    </div>
  );
}
