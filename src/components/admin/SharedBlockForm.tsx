"use client";

import { useState } from "react";
import {
  LANDING_STATUSES,
  MAX_TITLE_LENGTH,
  type LandingSection,
  type SharedBlockRecord,
} from "@/lib/landing";
import { slugify } from "@/lib/blog";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import SectionListEditor from "@/components/admin/SectionListEditor";

interface SharedBlockFormProps {
  block?: SharedBlockRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function SharedBlockForm({
  block,
  onSuccess,
  onCancel,
}: SharedBlockFormProps) {
  // Seeded once from the prop; the caller remounts with a `key` when it
  // switches blocks. See the note on LandingPageForm for why this is not an
  // effect.
  const [name, setName] = useState(block?.name ?? "");
  const [slug, setSlug] = useState(block?.slug ?? "");
  const [status, setStatus] = useState<string>(block?.status ?? "draft");
  const [sections, setSections] = useState<LandingSection[]>(
    () => block?.sections ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugLocked, setSlugLocked] = useState(Boolean(block));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        block
          ? `/api/admin/shared-blocks/${block.slug}`
          : "/api/admin/shared-blocks",
        {
          method: block ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, name: name.trim(), sections, status }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save the shared block");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-5"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {block ? `Edit ${block.name}` : "New shared block"}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="block-name">
            Name
          </label>
          <input
            id="block-name"
            className={inputClass}
            required
            maxLength={MAX_TITLE_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugLocked) setSlug(slugify(e.target.value));
            }}
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            What the section picker shows. Not part of any URL.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="block-slug">
            Slug
          </label>
          <input
            id="block-slug"
            className={`${inputClass} font-mono`}
            required
            value={slug}
            onChange={(e) => {
              setSlugLocked(true);
              setSlug(e.target.value);
            }}
          />
          {block && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pages reference this block by its slug. Changing it detaches them.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className={labelClass}>Sections</h3>
        {/* A block cannot contain a reference to another block: no cycle is
            expressible, so resolution needs no depth limit. */}
        <SectionListEditor
          sections={sections}
          onChange={setSections}
          allowBlockRefs={false}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <label className={labelClass} htmlFor="block-status">
            Status
          </label>
          <select
            id="block-status"
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {LANDING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            A draft block renders nothing on the pages that insert it.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-teal hover:bg-teal/90 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
