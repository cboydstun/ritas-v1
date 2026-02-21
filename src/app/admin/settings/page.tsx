"use client";

import { useState, useEffect } from "react";
import AdminAuthCheck from "@/components/admin/AdminAuthCheck";

interface MixerEntry {
  id: string;
  label: string;
  description: string;
  price: number;
}

interface SettingsData {
  fees: {
    deliveryFee: number;
    salesTaxRate: number;
    processingFeeRate: number;
    serviceDiscountRate: number;
  };
  machines: {
    single: { basePrice: number };
    double: { basePrice: number };
    triple: { basePrice: number };
  };
  mixers: Record<string, { label: string; description: string; price: number }>;
  extras: Record<string, { price: number }>;
  operations: {
    deliveryWindowStartHour: number;
    deliveryWindowEndHour: number;
  };
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const defaultSettings: SettingsData = {
  fees: {
    deliveryFee: 20,
    salesTaxRate: 0.0825,
    processingFeeRate: 0.03,
    serviceDiscountRate: 0.1,
  },
  machines: {
    single: { basePrice: 124.95 },
    double: { basePrice: 149.95 },
    triple: { basePrice: 175.95 },
  },
  mixers: {
    "non-alcoholic": {
      label: "Kool Aid Grape or Cherry Mixer",
      description:
        "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Naturally alcohol-free.",
      price: 19.95,
    },
    margarita: {
      label: "Margarita Mixer",
      description:
        "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Add your own tequila.",
      price: 19.95,
    },
    "pina-colada": {
      label: "Piña Colada Mixer",
      description:
        "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Add your own rum.",
      price: 24.95,
    },
    "strawberry-daiquiri": {
      label: "Strawberry Daiquiri Mixer",
      description:
        "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Add your own rum.",
      price: 24.95,
    },
  },
  extras: {
    "table-chairs": { price: 19.95 },
    "cotton-candy": { price: 49.95 },
    "bounce-castle": { price: 99.95 },
    "popcorn-machine": { price: 49.95 },
  },
  operations: {
    deliveryWindowStartHour: 8,
    deliveryWindowEndHour: 18,
  },
};

function mixersToEntries(
  mixers: Record<string, { label: string; description: string; price: number }>,
): MixerEntry[] {
  return Object.entries(mixers).map(([id, m]) => ({
    id,
    label: m.label ?? id,
    description: m.description ?? "",
    price: m.price,
  }));
}

function entriesToMixers(
  entries: MixerEntry[],
): Record<string, { label: string; description: string; price: number }> {
  return Object.fromEntries(
    entries.map((e) => [
      e.id,
      { label: e.label, description: e.description, price: e.price },
    ]),
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = "0.01",
  min = "0",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      />
    </div>
  );
}

function SectionCard({
  title,
  children,
  onSave,
  saving,
  saved,
  fullWidth,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h2>
      {fullWidth ? (
        <div className="mb-4">{children}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {children}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-teal hover:bg-teal/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Saved!
          </span>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Mixer CRUD state
  const [mixerEntries, setMixerEntries] = useState<MixerEntry[]>(
    mixersToEntries(defaultSettings.mixers),
  );
  const [newMixer, setNewMixer] = useState<Omit<MixerEntry, "id">>({
    label: "",
    description: "",
    price: 0,
  });
  const [showAddMixer, setShowAddMixer] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch settings");
        return res.json();
      })
      .then((data: SettingsData) => {
        setSettings(data);
        setMixerEntries(mixersToEntries(data.mixers ?? defaultSettings.mixers));
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load settings",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const saveSection = async (
    section: string,
    overrideSettings?: SettingsData,
  ) => {
    setSaving((prev) => ({ ...prev, [section]: true }));
    setSaved((prev) => ({ ...prev, [section]: false }));
    setError(null);

    const payload = overrideSettings ?? settings;

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save settings");
      }

      const updated: SettingsData = await res.json();
      setSettings(updated);
      setMixerEntries(
        mixersToEntries(updated.mixers ?? defaultSettings.mixers),
      );
      setSaved((prev) => ({ ...prev, [section]: true }));
      setTimeout(
        () => setSaved((prev) => ({ ...prev, [section]: false })),
        3000,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  };

  const saveMixers = () => {
    const updatedSettings: SettingsData = {
      ...settings,
      mixers: entriesToMixers(mixerEntries),
    };
    setSettings(updatedSettings);
    saveSection("mixers", updatedSettings);
  };

  const updateMixerEntry = (
    index: number,
    field: keyof MixerEntry,
    value: string | number,
  ) => {
    setMixerEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Auto-update id when label changes (only if id currently matches the old slugified label)
      if (field === "label") {
        const oldSlug = slugify(prev[index].label);
        if (prev[index].id === oldSlug || prev[index].id === "") {
          next[index].id = slugify(value as string);
        }
      }
      return next;
    });
  };

  const deleteMixerEntry = (index: number) => {
    setMixerEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const addMixer = () => {
    if (!newMixer.label.trim()) return;
    const id = slugify(newMixer.label);
    if (mixerEntries.some((e) => e.id === id)) {
      setError(
        `A mixer with the slug "${id}" already exists. Change the label.`,
      );
      return;
    }
    setMixerEntries((prev) => [
      ...prev,
      {
        id,
        label: newMixer.label.trim(),
        description: newMixer.description.trim(),
        price: newMixer.price,
      },
    ]);
    setNewMixer({ label: "", description: "", price: 0 });
    setShowAddMixer(false);
  };

  if (loading) {
    return (
      <AdminAuthCheck>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Settings
          </h1>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse"
              >
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-10 bg-gray-200 dark:bg-gray-700 rounded"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminAuthCheck>
    );
  }

  return (
    <AdminAuthCheck>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage business values without a code deploy
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Fees & Rates */}
        <SectionCard
          title="Fees & Rates"
          onSave={() => saveSection("fees")}
          saving={saving.fees ?? false}
          saved={saved.fees ?? false}
        >
          <NumberInput
            label="Delivery Fee ($)"
            value={settings.fees.deliveryFee}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                fees: { ...s.fees, deliveryFee: v },
              }))
            }
            step="1"
          />
          <NumberInput
            label="Sales Tax Rate (e.g. 0.0825 = 8.25%)"
            value={settings.fees.salesTaxRate}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                fees: { ...s.fees, salesTaxRate: v },
              }))
            }
            step="0.0001"
          />
          <NumberInput
            label="Processing Fee Rate (e.g. 0.03 = 3%)"
            value={settings.fees.processingFeeRate}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                fees: { ...s.fees, processingFeeRate: v },
              }))
            }
            step="0.001"
          />
          <NumberInput
            label="Service Discount Rate (e.g. 0.10 = 10%)"
            value={settings.fees.serviceDiscountRate}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                fees: { ...s.fees, serviceDiscountRate: v },
              }))
            }
            step="0.01"
          />
        </SectionCard>

        {/* Machine Pricing */}
        <SectionCard
          title="Machine Pricing"
          onSave={() => saveSection("machines")}
          saving={saving.machines ?? false}
          saved={saved.machines ?? false}
        >
          <NumberInput
            label="Single Tank Base Price ($)"
            value={settings.machines.single.basePrice}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                machines: {
                  ...s.machines,
                  single: { basePrice: v },
                },
              }))
            }
          />
          <NumberInput
            label="Double Tank Base Price ($)"
            value={settings.machines.double.basePrice}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                machines: {
                  ...s.machines,
                  double: { basePrice: v },
                },
              }))
            }
          />
          <NumberInput
            label="Triple Tank Base Price ($)"
            value={settings.machines.triple.basePrice}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                machines: {
                  ...s.machines,
                  triple: { basePrice: v },
                },
              }))
            }
          />
        </SectionCard>

        {/* Mixers — full CRUD */}
        <SectionCard
          title="Mixers"
          onSave={saveMixers}
          saving={saving.mixers ?? false}
          saved={saved.mixers ?? false}
          fullWidth
        >
          {/* Column headers */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_2fr_5rem_2.5rem] gap-2 mb-2 px-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Label
            </span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Description
            </span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Price ($)
            </span>
            <span />
          </div>

          {/* Existing mixer rows */}
          <div className="space-y-2">
            {mixerEntries.map((entry, i) => (
              <div
                key={entry.id || i}
                className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_5rem_2.5rem] gap-2 items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <input
                  type="text"
                  value={entry.label}
                  onChange={(e) => updateMixerEntry(i, "label", e.target.value)}
                  placeholder="Label"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full"
                />
                <input
                  type="text"
                  value={entry.description}
                  onChange={(e) =>
                    updateMixerEntry(i, "description", e.target.value)
                  }
                  placeholder="Description"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.price}
                  onChange={(e) =>
                    updateMixerEntry(
                      i,
                      "price",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full"
                />
                <button
                  type="button"
                  onClick={() => deleteMixerEntry(i)}
                  title="Delete mixer"
                  className="flex items-center justify-center w-9 h-9 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add Mixer form */}
          {showAddMixer ? (
            <div className="mt-3 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Mixer
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_5rem] gap-2 mb-3">
                <input
                  type="text"
                  value={newMixer.label}
                  onChange={(e) =>
                    setNewMixer((p) => ({ ...p, label: e.target.value }))
                  }
                  placeholder="Label (e.g. Mango Mixer)"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full"
                />
                <input
                  type="text"
                  value={newMixer.description}
                  onChange={(e) =>
                    setNewMixer((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Description"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMixer.price}
                  onChange={(e) =>
                    setNewMixer((p) => ({
                      ...p,
                      price: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="Price"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full"
                />
              </div>
              {newMixer.label && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  ID:{" "}
                  <code className="font-mono">{slugify(newMixer.label)}</code>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addMixer}
                  disabled={!newMixer.label.trim()}
                  className="px-3 py-1.5 bg-teal hover:bg-teal/90 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMixer(false);
                    setNewMixer({ label: "", description: "", price: 0 });
                  }}
                  className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddMixer(true)}
              className="mt-3 flex items-center gap-1.5 text-sm text-teal hover:text-teal/80 font-medium transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Mixer
            </button>
          )}
        </SectionCard>

        {/* Party Extras Pricing */}
        <SectionCard
          title="Party Extras Pricing"
          onSave={() => saveSection("extras")}
          saving={saving.extras ?? false}
          saved={saved.extras ?? false}
        >
          <NumberInput
            label="Table & Chairs Set ($)"
            value={settings.extras["table-chairs"]?.price ?? 19.95}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                extras: {
                  ...s.extras,
                  "table-chairs": { price: v },
                },
              }))
            }
          />
          <NumberInput
            label="Cotton Candy Machine ($)"
            value={settings.extras["cotton-candy"]?.price ?? 49.95}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                extras: {
                  ...s.extras,
                  "cotton-candy": { price: v },
                },
              }))
            }
          />
          <NumberInput
            label="Bounce Castle ($)"
            value={settings.extras["bounce-castle"]?.price ?? 99.95}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                extras: {
                  ...s.extras,
                  "bounce-castle": { price: v },
                },
              }))
            }
          />
          <NumberInput
            label="Popcorn Machine ($)"
            value={settings.extras["popcorn-machine"]?.price ?? 49.95}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                extras: {
                  ...s.extras,
                  "popcorn-machine": { price: v },
                },
              }))
            }
          />
        </SectionCard>

        {/* Business Operations */}
        <SectionCard
          title="Business Operations"
          onSave={() => saveSection("operations")}
          saving={saving.operations ?? false}
          saved={saved.operations ?? false}
        >
          <NumberInput
            label="Delivery Window Start Hour (0–23)"
            value={settings.operations.deliveryWindowStartHour}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                operations: {
                  ...s.operations,
                  deliveryWindowStartHour: Math.round(v),
                },
              }))
            }
            step="1"
            min="0"
          />
          <NumberInput
            label="Delivery Window End Hour (0–23)"
            value={settings.operations.deliveryWindowEndHour}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                operations: {
                  ...s.operations,
                  deliveryWindowEndHour: Math.round(v),
                },
              }))
            }
            step="1"
            min="0"
          />
        </SectionCard>
      </div>
    </AdminAuthCheck>
  );
}
