"use client";

import { useEffect, useState } from "react";
import {
  CONTENT_SECTION_KINDS,
  MAX_SECTIONS,
  SECTION_LABELS,
  defaultSection,
  isSectionKind,
  type LandingSection,
  type SharedBlockRecord,
} from "@/lib/landing";
import { rowButtonClass } from "@/components/admin/form-styles";
import SectionFields from "@/components/admin/SectionFields";

interface SectionListEditorProps {
  sections: LandingSection[];
  onChange: (sections: LandingSection[]) => void;
  /** Blocks may not contain a blockRef, so the picker hides that group. */
  allowBlockRefs?: boolean;
}

/** The one-line summary on a collapsed row, so a long page stays scannable. */
function summarise(section: LandingSection): string {
  switch (section.kind) {
    case "hero":
      return section.heading;
    case "richText":
      return (
        section.heading ?? section.html.replace(/<[^>]*>/g, "").slice(0, 60)
      );
    case "features":
    case "faq":
    case "linkList":
      return section.heading ?? `${section.items.length} items`;
    case "cta":
      return section.headline ?? "Standard booking prompt";
    case "pricingCards":
      return section.heading ?? "Live machine prices";
    case "nearbyAreas":
      return section.forSlug || "No area chosen";
    case "blockRef":
      return section.blockSlug || "No block chosen";
  }
}

export default function SectionListEditor({
  sections,
  onChange,
  allowBlockRefs = true,
}: SectionListEditorProps) {
  const [blocks, setBlocks] = useState<SharedBlockRecord[]>([]);
  const [picker, setPicker] = useState("");

  useEffect(() => {
    if (!allowBlockRefs) return;
    // One shot on mount, purely to populate the picker and to name the block a
    // `blockRef` row points at. A failure here is not worth surfacing: the
    // picker just shows no shared blocks.
    fetch("/api/admin/shared-blocks")
      .then((response) => (response.ok ? response.json() : []))
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }, [allowBlockRefs]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  /**
   * One control for both paths, so inserting a shared block feels like adding
   * a section rather than entering a separate mode.
   */
  const add = (value: string) => {
    setPicker("");
    if (!value) return;
    if (value.startsWith("block:")) {
      onChange([
        ...sections,
        { kind: "blockRef", blockSlug: value.slice("block:".length) },
      ]);
      return;
    }
    if (isSectionKind(value)) onChange([...sections, defaultSection(value)]);
  };

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <details
          key={index}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
        >
          <summary className="cursor-pointer px-3 py-2 flex items-center gap-3">
            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-teal/15 text-teal">
              {SECTION_LABELS[section.kind]}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {summarise(section)}
            </span>
          </summary>

          <div className="px-3 pb-3 space-y-3">
            <div className="flex justify-end gap-1">
              <button
                type="button"
                className={rowButtonClass}
                disabled={index === 0}
                aria-label={`Move ${SECTION_LABELS[section.kind]} section up`}
                onClick={() => move(index, index - 1)}
              >
                ▲
              </button>
              <button
                type="button"
                className={rowButtonClass}
                disabled={index === sections.length - 1}
                aria-label={`Move ${SECTION_LABELS[section.kind]} section down`}
                onClick={() => move(index, index + 1)}
              >
                ▼
              </button>
              <button
                type="button"
                className={`${rowButtonClass} text-red-600 dark:text-red-400`}
                aria-label={`Remove ${SECTION_LABELS[section.kind]} section`}
                onClick={() => {
                  if (!confirm("Remove this section?")) return;
                  onChange(sections.filter((_, i) => i !== index));
                }}
              >
                ×
              </button>
            </div>

            <SectionFields
              section={section}
              blocks={blocks}
              onChange={(updated) =>
                onChange(sections.map((s, i) => (i === index ? updated : s)))
              }
            />
          </div>
        </details>
      ))}

      <select
        className={rowButtonClass}
        value={picker}
        disabled={sections.length >= MAX_SECTIONS}
        aria-label="Add a section"
        onChange={(e) => add(e.target.value)}
      >
        <option value="">Add a section…</option>
        {CONTENT_SECTION_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {SECTION_LABELS[kind]}
          </option>
        ))}
        {allowBlockRefs && blocks.length > 0 && (
          <optgroup label="Shared blocks">
            {blocks.map((block) => (
              <option key={block.slug} value={`block:${block.slug}`}>
                {block.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
