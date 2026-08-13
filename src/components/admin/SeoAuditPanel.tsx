"use client";

import type {
  AuditCheck,
  AuditGroup,
  AuditReport,
  AuditSeverity,
} from "@/lib/seo-audit";

interface SeoAuditPanelProps {
  report: AuditReport;
  /** Absent while the duplicate check has not been run. */
  onCheckDuplicates?: () => void;
  checkingDuplicates?: boolean;
}

const GROUP_ORDER: AuditGroup[] = [
  "Title and Meta",
  "Content and Structure",
  "Links and Media",
  "Technical",
];

// Errors first, then warnings, so the things worth fixing are never below the
// fold of a long list of passes.
const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  error: 0,
  warning: 1,
  pass: 2,
  skipped: 3,
};

const SEVERITY_STYLES: Record<AuditSeverity, string> = {
  error: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  // --color-margarita fails AA on charcoal (2.46:1), so the dark surface uses
  // the lighter brand green.
  pass: "text-margarita dark:text-margarita-dark",
  skipped: "text-gray-500 dark:text-gray-400",
};

const SEVERITY_MARK: Record<AuditSeverity, string> = {
  error: "✕",
  warning: "!",
  pass: "✓",
  skipped: "–",
};

function scoreTone(score: number, errors: number): string {
  if (errors > 0 || score < 50) return "text-red-700 dark:text-red-400";
  if (score < 80) return "text-amber-700 dark:text-amber-400";
  return "text-margarita dark:text-margarita-dark";
}

function CheckRow({ check }: { check: AuditCheck }) {
  return (
    <li className="flex gap-3 py-2">
      <span
        aria-hidden="true"
        className={`mt-0.5 font-bold ${SEVERITY_STYLES[check.severity]}`}
      >
        {SEVERITY_MARK[check.severity]}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {check.label}
          </span>
          {check.value !== undefined && (
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
              {check.value}
            </span>
          )}
          <span className="sr-only">{check.severity}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {check.message}
        </p>
      </div>
    </li>
  );
}

export default function SeoAuditPanel({
  report,
  onCheckDuplicates,
  checkingDuplicates = false,
}: SeoAuditPanelProps) {
  return (
    <section
      aria-label="SEO audit"
      className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
    >
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          SEO audit
        </h3>
        <div className="text-right">
          <span
            className={`text-2xl font-bold ${scoreTone(report.score, report.errors)}`}
          >
            {report.score}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">/100</span>
        </div>
      </header>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {report.errors} error{report.errors === 1 ? "" : "s"}, {report.warnings}{" "}
        warning{report.warnings === 1 ? "" : "s"}. Advisory only — it never
        blocks a save.
      </p>

      {onCheckDuplicates && (
        <button
          type="button"
          onClick={onCheckDuplicates}
          disabled={checkingDuplicates}
          className="mb-4 text-sm text-teal hover:underline disabled:opacity-60"
        >
          {checkingDuplicates ? "Checking…" : "Check for duplicates"}
        </button>
      )}

      {GROUP_ORDER.map((group) => {
        const groupChecks = report.checks
          .filter((check) => check.group === group)
          .sort(
            (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
          );
        if (groupChecks.length === 0) return null;

        return (
          <div key={group} className="mb-4 last:mb-0">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {group}
            </h4>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {groupChecks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
