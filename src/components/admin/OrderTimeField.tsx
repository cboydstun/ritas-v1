import {
  FLEXIBLE_TIME,
  legPreference,
  type TimePreference,
} from "@/lib/specific-time-charge";

/**
 * A delivery or pickup time on the admin order modals: a required clock time
 * plus how firm it is — the same two facts the customer wizard collects.
 * Flexible (free) is delivery at or before the time and pickup at or after
 * it; specific is exactly then, and carries the specific-time charge.
 *
 * A legacy order stored a flexible leg as the `"ANY"` sentinel, which
 * `<input type="time">` cannot show. It renders as an empty, required input
 * with Flexible selected (`legPreference` reads "ANY" that way), so the office
 * names a real time the next time it edits that order rather than resaving
 * the sentinel.
 */
export function OrderTimeField({
  id,
  label,
  value,
  preference,
  onChange,
  onPreferenceChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  preference: TimePreference | undefined;
  onChange: (value: string) => void;
  onPreferenceChange: (preference: TimePreference) => void;
}) {
  const current = legPreference(value, preference);
  const shown = value === FLEXIBLE_TIME ? "" : (value ?? "");

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={shown}
        required
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
      />
      <div
        role="radiogroup"
        aria-label={`${label} preference`}
        className="mt-1 flex flex-wrap gap-x-4 text-sm text-gray-700 dark:text-gray-300"
      >
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${id}-preference`}
            checked={current === "flexible"}
            onChange={() => onPreferenceChange("flexible")}
          />
          Flexible (no fee)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${id}-preference`}
            checked={current === "specific"}
            onChange={() => onPreferenceChange("specific")}
          />
          Specific time (fee)
        </label>
      </div>
    </div>
  );
}
