"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import BlogPostsTable from "@/components/admin/BlogPostsTable";
import type { BlogPostRecord } from "@/lib/blog";

// Conditionally mounted and most admin sessions never open it, so it does not
// belong in the eagerly-loaded admin bundle — the same treatment
// BlackoutDateForm and AnalyticsCharts already get.
const BlogPostForm = dynamic(() => import("@/components/admin/BlogPostForm"), {
  ssr: false,
});

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPostRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/blog");
      if (!response.ok) throw new Error("Failed to fetch blog posts");

      setPosts(await response.json());
      // Clear any error left over from a previous action, so a failed delete
      // does not leave the banner up until a full page reload.
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [refreshTrigger]);

  const handleCreate = () => {
    setEditingPost(null);
    setShowForm(true);
  };

  /**
   * The list query excludes `body` — post bodies are HTML and would make the
   * table response enormous — so the row we already hold is not enough to
   * populate the editor. Without this fetch the form would open with an empty
   * body and saving would blank the post.
   */
  const handleEdit = async (post: BlogPostRecord) => {
    try {
      const response = await fetch(`/api/admin/blog/${post.slug}`);
      if (!response.ok) throw new Error("Failed to load the post for editing");

      setEditingPost(await response.json());
      setShowForm(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the post");
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/admin/blog/${slug}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete post");

      setRefreshTrigger((previous) => previous + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPost(null);
    setRefreshTrigger((previous) => previous + 1);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPost(null);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Blog
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Write, publish and retire posts. Drafts are invisible to visitors.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-teal hover:bg-teal/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            New Post
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-6">
            <BlogPostForm
              post={editingPost}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <BlogPostsTable
            posts={posts}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
