"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getDeliveryZoneInfo,
  type DeliverySettings,
} from "@/lib/delivery/zones";
import { minimumForZip, minimumOrderNotice } from "@/lib/delivery/tierMinimums";
import { validateZipCode } from "@/components/order/utils";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_HREF } from "@/lib/site";

/**
 * "What does delivery cost to my address?", answered before anyone starts a
 * booking.
 *
 * Reads the same `getDeliveryZoneInfo` the checkout reads, so the two cannot
 * drift — the failure this replaces is a site that advertises one delivery
 * price while checkout charges another.
 */
export default function DeliveryFeeChecker() {
  const [zones, setZones] = useState<DeliverySettings | undefined>();
  const [fallbackMinimum, setFallbackMinimum] = useState(0);
  const [zip, setZip] = useState("");
  const [checked, setChecked] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("no"))))
      .then(
        (data: {
          deliveryZones?: DeliverySettings;
          fees?: { minOrderAmount?: number };
        }) => {
          setZones(data.deliveryZones);
          setFallbackMinimum(data.fees?.minOrderAmount ?? 0);
        },
      )
      .catch(() => {
        // Left undefined: every ZIP then reads "we don't have a price for this
        // yet", which points at the phone number. Quoting a stale figure would
        // be worse than asking someone to call.
      });
  }, []);

  const info = checked ? getDeliveryZoneInfo(checked, zones) : null;
  // Fallback 0, deliberately: a ZIP with no band has no fee either, so it lands
  // in "not serviced" and this number is never displayed.
  const minimum = checked ? minimumForZip(checked, zones, fallbackMinimum) : 0;

  return (
    <div className="rounded-lg bg-light p-4 dark:bg-charcoal/50">
      <h3 className="mb-1 font-semibold text-charcoal dark:text-white">
        Check your ZIP
      </h3>
      <p className="mb-3 text-sm text-charcoal/80 dark:text-white/80">
        Delivery is quoted per ZIP code, up front, before you book.
      </p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setChecked(validateZipCode(zip) ? zip : null);
        }}
      >
        <label htmlFor="delivery-zip" className="sr-only">
          ZIP code
        </label>
        <input
          id="delivery-zip"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="78205"
          maxLength={10}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value);
            setChecked(null);
          }}
          className="w-32 rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-charcoal dark:border-white/20 dark:bg-charcoal dark:text-white"
        />
        <button
          type="submit"
          disabled={!validateZipCode(zip)}
          className="rounded-lg bg-teal px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          Check
        </button>
      </form>

      {info && (
        <div className="mt-3 text-sm" role="status">
          {info.zone === "not-supported" ? (
            <>
              <p className="font-semibold text-charcoal dark:text-white">
                We don&rsquo;t have a price set for that ZIP yet
              </p>
              <p className="mt-1 text-charcoal/80 dark:text-white/80">
                Call us and we&rsquo;ll see what we can do.
              </p>
              <a
                href={BUSINESS_PHONE_HREF}
                className="mt-2 inline-block rounded-lg bg-teal px-4 py-2 font-medium text-white"
              >
                Call {BUSINESS_PHONE_DISPLAY}
              </a>
            </>
          ) : (
            <>
              <p className="font-semibold text-charcoal dark:text-white">
                {info.fee === 0
                  ? `No distance surcharge for ${checked!.slice(0, 5)}`
                  : `$${info.fee} distance surcharge for ${checked!.slice(0, 5)}`}
              </p>
              {minimum > 0 && (
                <p className="mt-1 text-charcoal/80 dark:text-white/80">
                  {minimumOrderNotice(minimum)}
                </p>
              )}
              <Link
                href={`/order?zip=${checked!.slice(0, 5)}`}
                className="mt-2 inline-block rounded-lg bg-margarita px-4 py-2 font-medium text-white"
              >
                Book now
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
