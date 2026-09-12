"use client";

import { useMemo, useState } from "react";
import {
  listedZips,
  nextZone,
  unpricedListedZips,
  zipInventory,
  type ZipLists,
  type ZipZone,
} from "@/app/admin/delivery-zones/zipLists";
import type { ZipFeeRow } from "@/lib/delivery/zipFeeRows";
import { inputClass } from "@/components/admin/form-styles";

interface Props {
  rows: ZipFeeRow[];
  lists: ZipLists | null;
  selectedZip: string | null;
  isSaving: boolean;
  onSelectZip: (zipCode: string) => void;
  onSetZone: (zipCode: string, zone: ZipZone) => void;
}

const ZONE_LABEL: Record<string, string> = {
  inside: "inside",
  outside: "outside",
  none: "no zone",
};

export function ZipInventoryPanel({
  rows,
  lists,
  selectedZip,
  isSaving,
  onSelectZip,
  onSetZone,
}: Props) {
  const [filter, setFilter] = useState("");

  const inventory = useMemo(() => zipInventory(rows, lists), [rows, lists]);
  const unpriced = useMemo(
    () => unpricedListedZips(rows, listedZips(lists)),
    [rows, lists],
  );

  // "Serviced" counts priced ZIPs only, deliberately not `inventory.length` —
  // a listed ZIP with no fee is in the inventory precisely because it is *not*
  // serviced.
  const servicedCount = inventory.filter((r) => r.fee !== null).length;

  const visible = filter
    ? inventory.filter((r) => r.zipCode.startsWith(filter))
    : inventory;

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        ZIP inventory
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        {servicedCount} serviced &middot; {inventory.length} configured
      </p>

      {unpriced.length > 0 && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
          <p className="font-medium text-red-800 dark:text-red-200">
            {unpriced.length} ZIP{unpriced.length === 1 ? " is" : "s are"}{" "}
            listed with no surcharge
          </p>
          <p className="mt-1 text-red-700 dark:text-red-300">
            Checkout refuses orders to these. Click one to give it a price.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {unpriced.map((row) => (
              <button
                key={row.zipCode}
                type="button"
                onClick={() => onSelectZip(row.zipCode)}
                className="rounded-sm border border-red-400 px-2 py-0.5 text-red-800 dark:border-red-700 dark:text-red-200"
              >
                {row.zipCode}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        type="search"
        inputMode="numeric"
        placeholder="Filter by ZIP prefix"
        aria-label="Filter by ZIP prefix"
        className={`${inputClass} mb-3`}
        value={filter}
        onChange={(e) => setFilter(e.target.value.replace(/\D/g, ""))}
      />

      <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
        {visible.map((row) => (
          <li key={row.zipCode} className="flex items-center gap-2 py-1.5">
            <button
              type="button"
              onClick={() => onSelectZip(row.zipCode)}
              className={`flex-1 text-left text-sm ${
                row.zipCode === selectedZip
                  ? "font-semibold text-teal"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              <span
                aria-hidden
                className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                style={{ backgroundColor: row.bucket.fill }}
              />
              {row.zipCode}
            </button>

            <span className="w-16 text-right text-sm text-gray-600 dark:text-gray-400">
              {row.fee === null ? "none" : `$${row.fee}`}
            </span>

            <button
              type="button"
              disabled={lists === null || isSaving}
              onClick={() => onSetZone(row.zipCode, nextZone(row.zone))}
              title="Cycle zone: inside → outside → no zone"
              className="w-20 rounded-sm border border-gray-300 px-1 py-0.5 text-xs text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
            >
              {ZONE_LABEL[row.zone ?? "none"]}
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="py-3 text-sm text-gray-500 dark:text-gray-400">
            No ZIPs match that prefix.
          </li>
        )}
      </ul>
    </section>
  );
}
