"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeliverySettings } from "@/lib/delivery/zones";
import type { TierMinimums } from "@/lib/delivery/tierMinimums";

interface LoadedSettings {
  deliveryZones: DeliverySettings;
  fees?: { minOrderAmount?: number };
}

/**
 * The delivery-zone admin's read and its four narrow writes.
 *
 * Every write sends **only its own slice**. Spreading the loaded
 * `deliveryZones` into a save would re-send the whole fee map from whatever the
 * browser happened to be holding, so pricing one ZIP would revert every fee
 * written since the page loaded — bounce-v3 destroyed a verified production
 * seed exactly that way.
 *
 * `hasLoaded` is never reset on a failed refresh: the page refuses to render
 * anything before the first successful load (rendering defaults would show an
 * unstored ladder as if it were stored), but a later hiccup must not blank a
 * page the admin is working in.
 */
export function useDeliveryZones() {
  const [settings, setSettings] = useState<LoadedSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // State, not a ref: reading a ref during render is an error under
  // eslint-plugin-react-hooks 7, and this value decides what renders. It is
  // only ever set to true — a later failed refresh must not blank a page the
  // admin is working in.
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as LoadedSettings;
      setSettings(data);
      setHasLoaded(true);
      setLoadError(null);
    } catch {
      // Deliberately vague: the message is rendered, and an upstream error
      // string can carry a URL or a stack.
      setLoadError("Could not load delivery settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  /** One PATCH verb. Returns whether it stuck; never throws. */
  const patch = useCallback(async (body: unknown): Promise<boolean> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setSaveError(data?.message ?? "Could not save that change.");
        return false;
      }
      // The route answers with the whole document, so local state follows the
      // server rather than a guess at what the write did.
      setSettings((await response.json()) as LoadedSettings);
      return true;
    } catch {
      setSaveError("Could not save that change.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    settings,
    hasLoaded,
    isLoading,
    isSaving,
    loadError,
    saveError,
    dismissSaveError: useCallback(() => setSaveError(null), []),
    refetch: fetchSettings,
    saveCustomFee: useCallback(
      (zipCode: string, fee: number) =>
        patch({ setCustomZipFee: { zipCode, fee } }),
      [patch],
    ),
    removeCustomFee: useCallback(
      (zipCode: string) => patch({ removeCustomZipFee: zipCode }),
      [patch],
    ),
    saveZipLists: useCallback(
      (insideZips: string[], outsideZips: string[]) =>
        patch({ updateZipLists: { insideZips, outsideZips } }),
      [patch],
    ),
    saveTierMinimums: useCallback(
      (tiers: Partial<TierMinimums>) => patch({ updateTierMinimums: tiers }),
      [patch],
    ),
    saveBaseFee: useCallback(
      (baseFee: number) => patch({ updateBaseFee: baseFee }),
      [patch],
    ),
  };
}
