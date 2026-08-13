"use client";

import Link from "next/link";
import { landingPathToSegments, type LandingPageRecord } from "@/lib/landing";

interface LandingPagesTableProps {
  pages: LandingPageRecord[];
  loading: boolean;
  onEdit: (page: LandingPageRecord) => void;
  onDelete: (path: string) => void;
}

function formatDate(value?: Date | string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: LandingPageRecord["status"] }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
        published
          ? "bg-margarita/15 text-margarita-dark dark:bg-margarita-dark/20 dark:text-margarita-dark"
          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export default function LandingPagesTable({
  pages,
  loading,
  onEdit,
  onDelete,
}: LandingPagesTableProps) {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-10 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">
        No landing pages yet. Use “New Page” to build one, or seed the existing
        service-area pages.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {["Title", "Path", "Status", "Published", "Updated", ""].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {pages.map((page) => (
            <tr key={page.path}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {page.title}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                {page.path}
              </td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge status={page.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(page.publishedAt)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(page.updatedAt)}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap space-x-3">
                {/* A draft has no public URL — visiting it would 404, which
                    reads as a broken admin link — so it gets the preview
                    route instead, which renders any status. */}
                {page.status === "published" ? (
                  <Link
                    href={page.path}
                    target="_blank"
                    className="text-teal hover:underline"
                  >
                    View
                  </Link>
                ) : (
                  <Link
                    href={`/admin/preview/${landingPathToSegments(page.path).join("/")}`}
                    target="_blank"
                    className="text-teal hover:underline"
                  >
                    Preview
                  </Link>
                )}
                <button
                  onClick={() => onEdit(page)}
                  className="text-teal hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(page.path)}
                  className="text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
