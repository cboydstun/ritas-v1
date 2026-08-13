"use client";

import { rowButtonClass } from "@/components/admin/form-styles";

interface ItemListEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  /** Appended by "Add". */
  blank: () => T;
  addLabel: string;
  /** Names the row in the move/remove buttons' accessible labels. */
  rowLabel: (item: T, index: number) => string;
  children: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  max: number;
}

/**
 * A reorderable list of small records — feature bullets, FAQ entries, links.
 *
 * Move controls are ▲/▼ buttons rather than drag-and-drop. Drag-and-drop would
 * mean either a new dependency in a repo whose only UI packages are heroicons,
 * chart.js and react-day-picker, or a few hundred lines of pointer handling —
 * and either way it needs a keyboard fallback, which is exactly these buttons.
 */
export default function ItemListEditor<T>({
  items,
  onChange,
  blank,
  addLabel,
  rowLabel,
  children,
  max,
}: ItemListEditorProps<T>) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  const update = (index: number, patch: Partial<T>) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
        >
          <div className="flex justify-end gap-1 mb-2">
            <button
              type="button"
              className={rowButtonClass}
              disabled={index === 0}
              aria-label={`Move ${rowLabel(item, index)} up`}
              onClick={() => move(index, index - 1)}
            >
              ▲
            </button>
            <button
              type="button"
              className={rowButtonClass}
              disabled={index === items.length - 1}
              aria-label={`Move ${rowLabel(item, index)} down`}
              onClick={() => move(index, index + 1)}
            >
              ▼
            </button>
            <button
              type="button"
              className={`${rowButtonClass} text-red-600 dark:text-red-400`}
              aria-label={`Remove ${rowLabel(item, index)}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
          {children(item, (patch) => update(index, patch))}
        </div>
      ))}

      <button
        type="button"
        className={rowButtonClass}
        disabled={items.length >= max}
        onClick={() => onChange([...items, blank()])}
      >
        {addLabel}
      </button>
    </div>
  );
}
