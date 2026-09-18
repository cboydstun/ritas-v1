import { FLEXIBLE_TIME, isSpecificTime } from "@/lib/specific-time-charge";

/**
 * A delivery or pickup time on the admin order modals.
 *
 * `<input type="time">` cannot express the `"ANY"` sentinel a flexible leg is
 * stored as, so without the checkbox every order the office created or edited
 * was pinned to a clock time and billed the specific-time charge. Unticking
 * clears the time rather than inventing one; the input is then `required`, so
 * the form cannot submit a pinned leg with no time.
 */
export function OrderTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const flexible = !isSpecificTime(value) && value !== "";

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
        value={flexible ? "" : (value ?? "")}
        disabled={flexible}
        required={!flexible}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs disabled:opacity-50"
      />
      <label className="mt-1 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={flexible}
          onChange={(e) => onChange(e.target.checked ? FLEXIBLE_TIME : "")}
        />
        Any time (no specific-time fee)
      </label>
    </div>
  );
}
