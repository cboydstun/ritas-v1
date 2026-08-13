"use client";

import type { SharedBlockRecord } from "@/lib/landing";

interface SharedBlocksTableProps {
  blocks: SharedBlockRecord[];
  loading: boolean;
  onEdit: (block: SharedBlockRecord) => void;
  onDelete: (slug: string) => void;
}

export default function SharedBlocksTable({
  blocks,
  loading,
  onEdit,
  onDelete,
}: SharedBlocksTableProps) {
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

  if (blocks.length === 0) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">
        No shared blocks yet. A block is a run of sections you write once and
        insert into as many landing pages as you like.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {["Name", "Slug", "Sections", "Status", ""].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {blocks.map((block) => (
            <tr key={block.slug}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {block.name}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                {block.slug}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {block.sections?.length ?? 0}
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    block.status === "published"
                      ? "bg-margarita/15 text-margarita-dark dark:bg-margarita-dark/20 dark:text-margarita-dark"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  {block.status === "published" ? "Published" : "Draft"}
                </span>
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap space-x-3">
                <button
                  onClick={() => onEdit(block)}
                  className="text-teal hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(block.slug)}
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
