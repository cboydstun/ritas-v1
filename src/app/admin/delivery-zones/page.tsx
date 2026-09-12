"use client";

import { useCallback, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminAuthCheck from "@/components/admin/AdminAuthCheck";
import { useDeliveryZones } from "@/hooks/useDeliveryZones";
import { buildZipFeeRows, countByBucket } from "@/lib/delivery/zipFeeRows";
import { customFeeFor } from "@/lib/delivery/zones";
import { DEFAULT_BASE_DELIVERY_FEE } from "@/lib/delivery/deliveryCharge";
import {
  DEFAULT_TIER_MINIMUMS,
  type TierMinimums,
} from "@/lib/delivery/tierMinimums";
import { setZipZone, zipListsFromSettings, type ZipZone } from "./zipLists";
import { ZipInventoryPanel } from "@/components/admin/delivery-zones/ZipInventoryPanel";
import {
  ZoneLegendPanel,
  tierMinimumsKey,
} from "@/components/admin/delivery-zones/ZoneLegendPanel";
import { ZipDetailPanel } from "@/components/admin/delivery-zones/ZipDetailPanel";
import { GoogleDeliveryZoneMap } from "@/components/admin/delivery-zones/GoogleDeliveryZoneMap";

export default function DeliveryZonesPage() {
  const {
    settings,
    hasLoaded,
    isLoading,
    isSaving,
    loadError,
    saveError,
    dismissSaveError,
    refetch,
    saveCustomFee,
    removeCustomFee,
    saveZipLists,
    saveTierMinimums,
    saveBaseFee,
  } = useDeliveryZones();

  const [selectedZip, setSelectedZip] = useState<string | null>(null);

  const zones = settings?.deliveryZones;

  // Memoised on the settings object alone. The map draws ~84 polygons off
  // these rows, so keying this on anything that changes per keystroke would
  // tear all of them down and rebuild them while someone types a fee.
  const rows = useMemo(() => (zones ? buildZipFeeRows(zones) : []), [zones]);
  const counts = useMemo(() => countByBucket(rows), [rows]);
  const lists = useMemo(() => zipListsFromSettings(zones), [zones]);

  const storedTierMinimums: TierMinimums = useMemo(
    () => ({ ...DEFAULT_TIER_MINIMUMS, ...(zones?.tierMinimums ?? {}) }),
    [zones],
  );
  const fallbackMinimum = settings?.fees?.minOrderAmount ?? 0;
  // Absent on a document written before the field existed, which reads as the
  // current price rather than as free — the same rule the schema default and
  // `deliveryChargeFor` apply.
  const storedBaseFee = zones?.baseFee ?? DEFAULT_BASE_DELIVERY_FEE;

  const handleSetZone = useCallback(
    (zipCode: string, zone: ZipZone) => {
      if (!lists) return;
      const next = setZipZone(lists, zipCode, zone);
      if (next === lists) return;
      void saveZipLists(next.inside, next.outside);
    },
    [lists, saveZipLists],
  );

  if (isLoading && !hasLoaded) {
    return (
      <AdminAuthCheck>
        <AdminLayout>
          <p className="p-6 text-gray-600 dark:text-gray-400">
            Loading delivery settings…
          </p>
        </AdminLayout>
      </AdminAuthCheck>
    );
  }

  // A failed first load renders nothing — never defaults. Showing the shipped
  // ladder as though it were stored would let one band edit PATCH all five over
  // whatever production actually holds.
  if (!hasLoaded || !settings || !zones) {
    return (
      <AdminAuthCheck>
        <AdminLayout>
          <div className="p-6">
            <p className="text-red-700 dark:text-red-300">
              {loadError ?? "Could not load delivery settings."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        </AdminLayout>
      </AdminAuthCheck>
    );
  }

  const selectedFee = selectedZip ? customFeeFor(zones, selectedZip) : null;

  return (
    <AdminAuthCheck>
      <AdminLayout>
        <div className="p-4 sm:p-6">
          <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">
            Delivery zones
          </h1>
          <p className="mb-4 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
            Every ZIP we deliver to carries its own distance surcharge, and that
            surcharge is what defines the service area — a ZIP with no price is
            refused at checkout. The inside/outside lists are geography only;
            they change a label, never a price.
          </p>

          {/* A save error is a banner over a page that still works, not a
              replacement for it. */}
          {saveError && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">
                {saveError}
              </p>
              <button
                type="button"
                onClick={dismissSaveError}
                aria-label="Dismiss error"
                className="text-red-800 dark:text-red-200"
              >
                &times;
              </button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="order-2 min-h-96 lg:order-1">
              <GoogleDeliveryZoneMap
                rows={rows}
                selectedZip={selectedZip}
                onZipClick={setSelectedZip}
              />
            </div>

            <div className="order-1 space-y-4 lg:order-2">
              {selectedZip && (
                <ZipDetailPanel
                  key={selectedZip}
                  zipCode={selectedZip}
                  storedFee={selectedFee}
                  tierMinimums={storedTierMinimums}
                  fallbackMinimum={fallbackMinimum}
                  isSaving={isSaving}
                  onSave={saveCustomFee}
                  onRemove={removeCustomFee}
                  onClose={() => setSelectedZip(null)}
                />
              )}

              <ZoneLegendPanel
                key={tierMinimumsKey(storedTierMinimums)}
                countByBucket={counts}
                storedTierMinimums={storedTierMinimums}
                fallbackMinimum={fallbackMinimum}
                storedBaseFee={storedBaseFee}
                isSaving={isSaving}
                onSave={saveTierMinimums}
                onSaveBaseFee={saveBaseFee}
              />

              <ZipInventoryPanel
                rows={rows}
                lists={lists}
                selectedZip={selectedZip}
                isSaving={isSaving}
                onSelectZip={setSelectedZip}
                onSetZone={handleSetZone}
              />
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminAuthCheck>
  );
}
