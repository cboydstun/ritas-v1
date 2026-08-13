"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MAX_RICH_TEXT_LENGTH,
  MAX_SECTION_ITEMS,
  type CtaLink,
  type FaqItem,
  type FeatureItem,
  type LandingSection,
  type SharedBlockRecord,
} from "@/lib/landing";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import ItemListEditor from "@/components/admin/ItemListEditor";

interface SectionFieldsProps {
  section: LandingSection;
  onChange: (section: LandingSection) => void;
  /** For the blockRef row's name, status and "not found" state. */
  blocks: SharedBlockRecord[];
}

function LinkFields({
  value,
  onChange,
  label,
}: {
  value: CtaLink | undefined;
  onChange: (link: CtaLink | undefined) => void;
  label: string;
}) {
  const link = value ?? { label: "", href: "" };
  const set = (patch: Partial<CtaLink>) => {
    const next = { ...link, ...patch };
    // Both blank means "no link", not an invalid one. Sending a half-filled
    // pair would fail validation on a field the admin thought was empty.
    onChange(next.label || next.href ? next : undefined);
  };

  return (
    <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <legend className={labelClass}>{label}</legend>
      <input
        className={inputClass}
        placeholder="Link text"
        value={link.label}
        onChange={(e) => set({ label: e.target.value })}
      />
      <input
        className={inputClass}
        placeholder="/order"
        value={link.href}
        onChange={(e) => set({ href: e.target.value })}
      />
    </fieldset>
  );
}

/**
 * One `switch` rather than eight files. These are ten- to twenty-line field
 * groups, and the switch is the readable form of a discriminated union — the
 * exhaustiveness is checked by the compiler.
 */
export default function SectionFields({
  section,
  onChange,
  blocks,
}: SectionFieldsProps) {
  const [showPreview, setShowPreview] = useState(false);

  switch (section.kind) {
    case "hero":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Eyebrow</label>
            <input
              className={inputClass}
              value={section.eyebrow ?? ""}
              onChange={(e) =>
                onChange({ ...section, eyebrow: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              required
              value={section.heading}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value })
              }
            />
          </div>
          <div>
            <label className={labelClass}>Intro</label>
            <textarea
              className={inputClass}
              rows={3}
              value={section.body ?? ""}
              onChange={(e) =>
                onChange({ ...section, body: e.target.value || undefined })
              }
            />
          </div>
          <LinkFields
            label="Primary button"
            value={section.primaryCta}
            onChange={(primaryCta) => onChange({ ...section, primaryCta })}
          />
          <LinkFields
            label="Secondary button"
            value={section.secondaryCta}
            onChange={(secondaryCta) => onChange({ ...section, secondaryCta })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={section.phoneCta ?? false}
              onChange={(e) =>
                onChange({
                  ...section,
                  phoneCta: e.target.checked || undefined,
                })
              }
            />
            {/* The number itself lives in site.ts and is never stored on a
                page, so it changes in one place. */}
            Show a call button with the business phone number
          </label>
        </div>
      );

    case "richText":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={labelClass}>HTML</label>
              <button
                type="button"
                className="text-sm text-teal hover:underline"
                onClick={() => setShowPreview((previous) => !previous)}
              >
                {showPreview ? "Edit" : "Preview"}
              </button>
            </div>
            {showPreview ? (
              <div
                className="prose dark:prose-invert max-w-none rounded-lg border border-gray-300 dark:border-gray-600 p-3"
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            ) : (
              <textarea
                className={`${inputClass} font-mono text-sm`}
                rows={8}
                maxLength={MAX_RICH_TEXT_LENGTH}
                value={section.html}
                onChange={(e) => onChange({ ...section, html: e.target.value })}
              />
            )}
          </div>
        </div>
      );

    case "features":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value || undefined })
              }
            />
          </div>
          <ItemListEditor
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            blank={(): FeatureItem => ({ body: "" })}
            addLabel="Add item"
            rowLabel={(item, index) => item.title || `item ${index + 1}`}
            max={MAX_SECTION_ITEMS}
          >
            {(item, update) => (
              <div className="space-y-2">
                <div className="grid grid-cols-[4rem_1fr] gap-2">
                  <input
                    className={inputClass}
                    placeholder="🚚"
                    aria-label="Icon"
                    value={item.icon ?? ""}
                    onChange={(e) =>
                      update({ icon: e.target.value || undefined })
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Title (optional)"
                    value={item.title ?? ""}
                    onChange={(e) =>
                      update({ title: e.target.value || undefined })
                    }
                  />
                </div>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Body"
                  value={item.body}
                  onChange={(e) => update({ body: e.target.value })}
                />
              </div>
            )}
          </ItemListEditor>
        </div>
      );

    case "faq":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value || undefined })
              }
            />
          </div>
          {/* Also emitted as a FAQPage JSON-LD node by the public renderer. */}
          <ItemListEditor
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            blank={(): FaqItem => ({ question: "", answer: "" })}
            addLabel="Add question"
            rowLabel={(item, index) => item.question || `question ${index + 1}`}
            max={MAX_SECTION_ITEMS}
          >
            {(item, update) => (
              <div className="space-y-2">
                <input
                  className={inputClass}
                  placeholder="Question"
                  value={item.question}
                  onChange={(e) => update({ question: e.target.value })}
                />
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="Answer"
                  value={item.answer}
                  onChange={(e) => update({ answer: e.target.value })}
                />
              </div>
            )}
          </ItemListEditor>
        </div>
      );

    case "cta":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Headline</label>
            <input
              className={inputClass}
              placeholder="Leave blank for the standard booking prompt"
              value={section.headline ?? ""}
              onChange={(e) =>
                onChange({ ...section, headline: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <label className={labelClass}>Subtext</label>
            <textarea
              className={inputClass}
              rows={2}
              value={section.subtext ?? ""}
              onChange={(e) =>
                onChange({ ...section, subtext: e.target.value || undefined })
              }
            />
          </div>
        </div>
      );

    case "linkList":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value || undefined })
              }
            />
          </div>
          <ItemListEditor
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            blank={(): CtaLink => ({ label: "", href: "/" })}
            addLabel="Add link"
            rowLabel={(item, index) => item.label || `link ${index + 1}`}
            max={MAX_SECTION_ITEMS}
          >
            {(item, update) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="Link text"
                  value={item.label}
                  onChange={(e) => update({ label: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="/pricing"
                  value={item.href}
                  onChange={(e) => update({ href: e.target.value })}
                />
              </div>
            )}
          </ItemListEditor>
        </div>
      );

    case "pricingCards":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value || undefined })
              }
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Machine names and prices come from Settings when the page renders,
            so a price change reaches every page carrying this section. There is
            nothing to edit here.
          </p>
        </div>
      );

    case "nearbyAreas":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <label className={labelClass}>Area this page is about</label>
            <input
              className={inputClass}
              placeholder="olmos-park"
              value={section.forSlug}
              onChange={(e) =>
                onChange({ ...section, forSlug: e.target.value })
              }
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              The links are worked out from the service-area list at render
              time, so adding a new area updates every page automatically.
            </p>
          </div>
        </div>
      );

    case "blockRef": {
      const block = blocks.find((entry) => entry.slug === section.blockSlug);
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Shared block</label>
            {block ? (
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {block.name}{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  ({block.status})
                </span>
              </p>
            ) : (
              // Not an error state for the visitor — the public renderer drops
              // an unresolvable reference silently — but the admin needs to see
              // that this section is contributing nothing.
              <p className="text-sm text-red-600 dark:text-red-400">
                No block with the slug “{section.blockSlug || "—"}”. This
                section will render nothing.
              </p>
            )}
            <Link
              href="/admin/shared-blocks"
              className="text-sm text-teal hover:underline"
            >
              Edit shared blocks ↗
            </Link>
          </div>
          <div>
            <label className={labelClass}>
              Replace the block&rsquo;s heading
            </label>
            <input
              className={inputClass}
              placeholder="Leave blank to keep the block's own heading"
              value={section.headingOverride ?? ""}
              onChange={(e) =>
                onChange({
                  ...section,
                  headingOverride: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>
      );
    }
  }
}
