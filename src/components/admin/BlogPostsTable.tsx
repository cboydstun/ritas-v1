"use client";

import Link from "next/link";
import type { BlogPostRecord } from "@/lib/blog";

interface BlogPostsTableProps {
  posts: BlogPostRecord[];
  loading: boolean;
  onEdit: (post: BlogPostRecord) => void;
  onDelete: (slug: string) => void;
}

function formatDate(value?: Date | string): string {
  if (!value) return "—";
  // Date-only strings parse as UTC midnight, which is the previous day in
  // Central. These are full timestamps, so `new Date` is correct here.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: BlogPostRecord["status"] }) {
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

export default function BlogPostsTable({
  posts,
  loading,
  onEdit,
  onDelete,
}: BlogPostsTableProps) {
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

  if (posts.length === 0) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">
        No posts yet. Use “New Post” to write the first one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {["Title", "Slug", "Status", "Published", "Updated", ""].map(
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
          {posts.map((post) => (
            <tr key={post.slug}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {post.title}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                {post.slug}
              </td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge status={post.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(post.publishedAt)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(post.updatedAt)}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap space-x-3">
                {/* Only published posts have a public URL to visit; a draft
                    would 404, which reads as a broken admin link. */}
                {post.status === "published" && (
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="text-teal hover:underline"
                  >
                    View
                  </Link>
                )}
                <button
                  onClick={() => onEdit(post)}
                  className="text-teal hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(post.slug)}
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
