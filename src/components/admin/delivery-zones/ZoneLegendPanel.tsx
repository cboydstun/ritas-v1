"use client";

import { useState } from "react";
import { FEE_BUCKETS, FEE_BUCKET_ORDER } from "@/lib/delivery/feeBuckets";
import {
  TIER_MINIMUM_ORDER,
  formatMinimum,
  isPricedBucket,
  type TierMinimums,
} from "@/lib/delivery/tierMinimums";
import { inputClass } from "@/components/admin/form-styles";

interface Props {
  /** How many configured ZIPs sit in each band. */
  countByBucket: Record<string, number>;
  /** The ladder as stored, already merged over the schema defaults. */
  storedTierMinimums: TierMinimums;
  /** What an unbanded ZIP falls back to — `Settings.fees.minOrderAmount`. */
  fallbackMinimum: number;
  /** `Settings.deliveryZones.baseFee` as stored. */
  storedBaseFee: number;
  isSaving: boolean;
  onSave: (tiers: Partial<TierMinimums>) => Promise<boolean>;
  onSaveBaseFee: (baseFee: number) => Promise<boolean>;
}

/**
 * The remount key for this panel: the stored ladder's *values*, never the
 * object's identity.
 *
 * The page rebuilds `storedTierMinimums` on every settings change, so keying on
 * identity would throw away an in-progress ladder edit every time a ZIP fee was
 * saved. Keying on the values means the draft is only discarded when the stored
 * ladder genuinely changed — which is exactly when it should be.
 */
export function tierMinimumsKey(stored: TierMinimums): string {
  return TIER_MINIMUM_ORDER.map((id) => stored[id]).join("|");
}

// The base fee is deliberately NOT part of that key. Saving it would otherwise
// remount the panel and throw away an in-progress ladder edit, which is the
// exact failure the key was introduced to prevent; it keeps its own draft
// instead.

/**
 * The fee legend, and the order-minimum ladder that hangs off it.
 *
 * The ladder is a **local draft saved on a button**, never per keystroke — a
 * PATCH per digit would write `$2`, `$25`, `$250` in sequence, and the middle
 * two are real refusals for anyone checking out at that moment.
 */
export function ZoneLegendPanel({
  countByBucket,
  storedTierMinimums,
  fallbackMinimum,
  storedBaseFee,
  isSaving,
  onSave,
  onSaveBaseFee,
}: Props) {
  const [draft, setDraft] = useState<TierMinimums>(storedTierMinimums);
  const [baseDraft, setBaseDraft] = useState<number>(storedBaseFee);

  const dirty = TIER_MINIMUM_ORDER.some(
    (id) => draft[id] !== storedTierMinimums[id],
  );
  const baseDirty = baseDraft !== storedBaseFee;

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
        Fee bands
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        A ZIP&rsquo;s band comes from its own surcharge, and its minimum order
        comes from the band. Set a band to $0 for no minimum.
      </p>

      <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
        <label
          htmlFor="delivery-base-fee"
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          Base delivery fee
        </label>
        <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
          Charged on every order, on top of its ZIP&rsquo;s surcharge. This is
          what pays for the truck and the trip; the surcharge only prices the
          distance. Set it to $0 to charge distance alone.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="delivery-base-fee"
            type="number"
            min={0}
            step={5}
            className={`${inputClass} max-w-28`}
            value={baseDraft}
            onChange={(e) =>
              setBaseDraft(Math.max(0, Number(e.target.value) || 0))
            }
          />
          {baseDirty && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onSaveBaseFee(baseDraft)}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save base fee"}
            </button>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400">
            <th className="py-1 font-medium">Band</th>
            <th className="py-1 font-medium">Surcharge &middot; ZIPs</th>
            <th className="py-1 font-medium">Min. order</th>
          </tr>
        </thead>
        <tbody>
          {FEE_BUCKET_ORDER.map((id) => {
            const bucket = FEE_BUCKETS[id];
            return (
              <tr
                key={id}
                className="border-t border-gray-100 dark:border-gray-700"
              >
                <td className="py-2">
                  <span className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{
                        backgroundColor: bucket.fill,
                        outline: `1px solid ${bucket.stroke}`,
                      }}
                    />
                    {bucket.label}
                  </span>
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">
                  {bucket.range} &middot; {countByBucket[id] ?? 0}
                </td>
                <td className="py-2">
                  {isPricedBucket(id) ? (
                    <input
                      type="number"
                      min={0}
                      step={5}
                      aria-label={`Minimum order for the ${bucket.label} band`}
                      className={`${inputClass} max-w-28`}
                      value={draft[id]}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [id]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      fallback &middot; {formatMinimum(fallbackMinimum)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {dirty && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSave(draft)}
          className="mt-3 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save minimums"}
        </button>
      )}
    </section>
  );
}
