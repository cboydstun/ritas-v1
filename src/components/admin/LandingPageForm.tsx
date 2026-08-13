"use client";

import { useMemo, useState } from "react";
import {
  LANDING_STATUSES,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  SCHEMA_TYPES,
  landingPathToSegments,
  pathify,
  type LandingPageRecord,
  type LandingSection,
} from "@/lib/landing";
import { MAX_FOCUS_KEYWORD_LENGTH } from "@/lib/blog";
import {
  auditLandingPage,
  sectionsToHtml,
  type LandingCrossPageFacts,
} from "@/lib/landing-audit";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import SectionListEditor from "@/components/admin/SectionListEditor";
import SeoAuditPanel from "@/components/admin/SeoAuditPanel";

interface LandingPageFormProps {
  page?: LandingPageRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  path: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  ogImagePath: string;
  focusKeyword: string;
  serviceAreaName: string;
  schemaType: string;
  status: string;
}

const EMPTY: FormState = {
  path: "",
  title: "",
  seoTitle: "",
  seoDescription: "",
  ogImagePath: "",
  focusKeyword: "",
  serviceAreaName: "",
  schemaType: "WebPage",
  status: "draft",
};

function initialState(page?: LandingPageRecord | null): FormState {
  if (!page) return EMPTY;
  return {
    path: page.path,
    title: page.title,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    ogImagePath: page.ogImagePath ?? "",
    focusKeyword: page.focusKeyword ?? "",
    serviceAreaName: page.serviceAreaName ?? "",
    schemaType: page.schemaType ?? "WebPage",
    status: page.status,
  };
}

/**
 * State is seeded from the `page` prop once, in the `useState` initialisers,
 * rather than mirrored into it by an effect. The caller passes a `key` derived
 * from the page, so switching which page is being edited remounts this
 * component and re-runs them.
 *
 * The effect version worked, but it was a `react-hooks/set-state-in-effect`
 * warning per field group and it re-ran on every referentially-new `page`
 * object — including one the parent rebuilt without the content changing,
 * which would discard the admin's unsaved edits.
 */
export default function LandingPageForm({
  page,
  onSuccess,
  onCancel,
}: LandingPageFormProps) {
  const [formData, setFormData] = useState<FormState>(() => initialState(page));
  const [sections, setSections] = useState<LandingSection[]>(
    () => page?.sections ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once the admin types a path by hand, the title must stop overwriting it.
  // An existing page starts locked: deriving a rename from a title edit would
  // silently move a URL that is already indexed.
  const [pathLocked, setPathLocked] = useState(Boolean(page));
  // `undefined` means "not checked yet" and renders the four cross-page rows
  // as skipped. There is no `null` state to distinguish: the route always
  // answers with a full set of facts, even when they are all empty.
  const [crossPage, setCrossPage] = useState<LandingCrossPageFacts | undefined>(
    undefined,
  );
  const [checkingCrossPage, setCheckingCrossPage] = useState(false);

  /**
   * Derived with useMemo rather than computed into state by an effect. An
   * effect here would be a `set-state-in-effect` warning and, worse, a render
   * behind whatever the admin just typed.
   */
  const report = useMemo(
    () =>
      auditLandingPage({
        path: formData.path,
        title: formData.title,
        seoTitle: formData.seoTitle,
        seoDescription: formData.seoDescription,
        ogImagePath: formData.ogImagePath,
        focusKeyword: formData.focusKeyword,
        schemaType: formData.schemaType,
        serviceAreaName: formData.serviceAreaName,
        breadcrumbs: page?.breadcrumbs,
        sections,
        status: formData.status,
        crossPage,
      }),
    [formData, sections, page?.breadcrumbs, crossPage],
  );

  // On demand, not per keystroke: this POSTs the whole page text and reads
  // every other landing page, which is not something to do per character.
  const handleCheckCrossPage = async () => {
    setCheckingCrossPage(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/landing-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: page?.path,
          text: sectionsToHtml(sections),
          seoTitle: formData.seoTitle || formData.title,
          seoDescription: formData.seoDescription,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to check the other pages");
      }
      setCrossPage((await response.json()) as LandingCrossPageFacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check");
    } finally {
      setCheckingCrossPage(false);
    }
  };

  const setField = (patch: Partial<FormState>) =>
    setFormData((previous) => ({ ...previous, ...patch }));

  const handleTitleChange = (title: string) => {
    setField(pathLocked ? { title } : { title, path: pathify(title) });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Assembled field by field, and blank optional fields are omitted rather
      // than sent as "". The schemas tolerate the empty string, but omitting it
      // on create is what keeps an unset field genuinely unset.
      const body: Record<string, unknown> = {
        path: formData.path,
        title: formData.title.trim(),
        sections,
        schemaType: formData.schemaType,
        status: formData.status,
      };
      for (const field of [
        "seoTitle",
        "seoDescription",
        "ogImagePath",
        "focusKeyword",
        "serviceAreaName",
      ] as const) {
        const value = formData[field].trim();
        // On edit the empty string is meaningful — it is how the admin clears
        // a field — so it is sent. On create there is nothing to clear.
        if (value || page) body[field] = value;
      }

      const response = await fetch(
        page
          ? `/api/admin/landing-pages${page.path}`
          : "/api/admin/landing-pages",
        {
          method: page ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save the landing page");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const previewHref = formData.path
    ? `/admin/preview/${landingPathToSegments(formData.path).join("/")}`
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-5"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {page ? `Edit ${page.path}` : "New landing page"}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="landing-title">
            Title
          </label>
          <input
            id="landing-title"
            className={inputClass}
            required
            maxLength={MAX_TITLE_LENGTH}
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="landing-path">
            Path
          </label>
          <input
            id="landing-path"
            className={`${inputClass} font-mono`}
            required
            placeholder="/margarita-machine-rental-weddings"
            value={formData.path}
            onChange={(e) => {
              setPathLocked(true);
              setField({ path: e.target.value });
            }}
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {page
              ? "Changing this moves the page's public URL. Nothing redirects the old one."
              : "Lowercase words and hyphens. Paths an existing route owns, such as /order, are refused."}
          </p>
        </div>
      </div>

      <div>
        <h3 className={labelClass}>Sections</h3>
        <SectionListEditor sections={sections} onChange={setSections} />
      </div>

      <SeoAuditPanel
        report={report}
        onCheckDuplicates={handleCheckCrossPage}
        checkingDuplicates={checkingCrossPage}
        checkLabel="Check against other pages"
      />

      <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
          Search engines and structured data
        </summary>
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>SEO title</label>
              <input
                className={inputClass}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="Falls back to the title above"
                value={formData.seoTitle}
                onChange={(e) => setField({ seoTitle: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Social image path</label>
              <input
                className={inputClass}
                placeholder="/og-image.jpg"
                value={formData.ogImagePath}
                onChange={(e) => setField({ ogImagePath: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Meta description</label>
            <textarea
              className={inputClass}
              rows={2}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={formData.seoDescription}
              onChange={(e) => setField({ seoDescription: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Focus keyword</label>
            <input
              className={inputClass}
              maxLength={MAX_FOCUS_KEYWORD_LENGTH}
              value={formData.focusKeyword}
              onChange={(e) => setField({ focusKeyword: e.target.value })}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Leave blank to skip the keyword checks rather than fail them.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Structured data type</label>
              <select
                className={inputClass}
                value={formData.schemaType}
                onChange={(e) => setField({ schemaType: e.target.value })}
              >
                {SCHEMA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {formData.schemaType === "Service" && (
              <div>
                <label className={labelClass}>Area served</label>
                <input
                  className={inputClass}
                  placeholder="Olmos Park, San Antonio, TX"
                  value={formData.serviceAreaName}
                  onChange={(e) =>
                    setField({ serviceAreaName: e.target.value })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <label className={labelClass} htmlFor="landing-status">
            Status
          </label>
          <select
            id="landing-status"
            className={inputClass}
            value={formData.status}
            onChange={(e) => setField({ status: e.target.value })}
          >
            {LANDING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          {/* Preview reads the saved document, not the form. Offering it on an
              unsaved page would show the previous version and read as a bug. */}
          {page && previewHref && (
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Preview saved version
            </a>
          )}
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
