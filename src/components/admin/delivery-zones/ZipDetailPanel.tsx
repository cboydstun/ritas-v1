"use client";

import { useState } from "react";
import { bucketForFee } from "@/lib/delivery/feeBuckets";
import {
  formatMinimum,
  minimumForFee,
  type TierMinimums,
} from "@/lib/delivery/tierMinimums";
import { inputClass, labelClass } from "@/components/admin/form-styles";

interface Props {
  zipCode: string;
  /** The stored fee, or `null` when nothing has priced this ZIP. */
  storedFee: number | null;
  tierMinimums: TierMinimums;
  fallbackMinimum: number;
  isSaving: boolean;
  onSave: (zipCode: string, fee: number) => Promise<boolean>;
  onRemove: (zipCode: string) => Promise<boolean>;
  onClose: () => void;
}

export function ZipDetailPanel({
  zipCode,
  storedFee,
  tierMinimums,
  fallbackMinimum,
  isSaving,
  onSave,
  onRemove,
  onClose,
}: Props) {
  // `number | null`, never 0. $0 is a real price, and pre-filling it made free
  // delivery the one-click default for a ZIP nobody had priced.
  //
  // Initialised from the prop with no adopt-effect: the parent renders this
  // with `key={selectedZip}`, so selecting a different ZIP remounts the panel
  // and both pieces of state start fresh. An effect would reset them one paint
  // late, after the previous ZIP's figure had already been shown under the new
  // ZIP's heading.
  const [fee, setFee] = useState<number | null>(storedFee);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Computed from the *typed* fee, not the stored one, so the consequence of a
  // change is visible before it is saved.
  const minimum = minimumForFee(fee, tierMinimums, fallbackMinimum);
  const bucket = bucketForFee(fee);

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          ZIP {zipCode}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ZIP detail"
          className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
        >
          &times;
        </button>
      </div>

      <label className={labelClass} htmlFor="zip-fee">
        Distance surcharge
      </label>
      <input
        id="zip-fee"
        type="number"
        min={0}
        step={5}
        placeholder="none"
        className={inputClass}
        value={fee ?? ""}
        onChange={(e) =>
          setFee(
            e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
          )
        }
      />
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Band: {bucket.label}. A ZIP with no surcharge is not in the service area
        — checkout refuses it.
      </p>

      <dl className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm dark:border-gray-700">
        <dt className="text-gray-600 dark:text-gray-400">Minimum order</dt>
        <dd className="font-medium text-gray-900 dark:text-white">
          {minimum > 0 ? formatMinimum(minimum) : "none"}
        </dd>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={fee === null || isSaving}
          onClick={() => fee !== null && onSave(zipCode, fee)}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save surcharge"}
        </button>

        {storedFee !== null &&
          (confirmingRemove ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                if (await onRemove(zipCode)) onClose();
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm: remove {zipCode} from the service area
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-700 dark:text-red-300"
            >
              Remove surcharge
            </button>
          ))}
      </div>

      {confirmingRemove && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          Removing {zipCode}&rsquo;s surcharge takes it out of the service area.
          Checkout will refuse orders to this ZIP.
        </p>
      )}
    </section>
  );
}
