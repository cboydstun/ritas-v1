"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import LandingPagesTable from "@/components/admin/LandingPagesTable";
import type { LandingPageRecord } from "@/lib/landing";
import { SERVICE_AREAS } from "@/lib/service-areas";
import { serviceAreaPath } from "@/lib/service-area-page";

// Conditionally mounted and most admin sessions never open it, so it does not
// belong in the eagerly-loaded admin bundle — the same treatment
// BlogPostForm and BlackoutDateForm already get.
const LandingPageForm = dynamic(
  () => import("@/components/admin/LandingPageForm"),
  { ssr: false },
);

export default function LandingPagesAdminPage() {
  const [pages, setPages] = useState<LandingPageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPage, setEditingPage] = useState<LandingPageRecord | null>(
    null,
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [seeding, setSeeding] = useState(false);

  /**
   * Adding an area to `SERVICE_AREAS` still gives it a homepage link, a hub
   * entry and a sitemap entry — but no longer a page, because the page now
   * lives in the database. The new ritual is "add the area, then seed", and
   * this is the only place that drift can be observed. Without it someone adds
   * an area in a year and ships a homepage link to a 404.
   */
  const unseeded = SERVICE_AREAS.filter(
    (area) => !pages.some((page) => page.path === serviceAreaPath(area.slug)),
  );

  const fetchPages = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/landing-pages");
      if (!response.ok) throw new Error("Failed to fetch landing pages");

      setPages(await response.json());
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
    fetchPages();
  }, [refreshTrigger]);

  const handleCreate = () => {
    setEditingPage(null);
    setShowForm(true);
  };

  /**
   * The list query excludes `sections`, which is where all the content lives,
   * so the row we already hold is not enough to populate the editor. Without
   * this fetch the form would open empty and saving would blank the page.
   */
  const handleEdit = async (page: LandingPageRecord) => {
    try {
      const response = await fetch(`/api/admin/landing-pages${page.path}`);
      if (!response.ok) throw new Error("Failed to load the page for editing");

      setEditingPage(await response.json());
      setShowForm(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the page");
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Delete "${path}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/admin/landing-pages${path}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete the page");

      setRefreshTrigger((previous) => previous + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPage(null);
    setRefreshTrigger((previous) => previous + 1);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const response = await fetch("/api/admin/service-area-seed", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to seed the service areas");

      setRefreshTrigger((previous) => previous + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed");
    } finally {
      setSeeding(false);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPage(null);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Landing Pages
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Build and edit pages at any URL. Drafts are invisible to visitors.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-teal hover:bg-teal/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            New Page
          </button>
        </div>

        {/* Only rendered once the list has loaded, so an empty table during
            the first fetch does not read as "nothing is seeded". */}
        {!loading && unseeded.length > 0 && (
          <div className="bg-amber-100 border border-amber-400 text-amber-900 px-4 py-3 rounded-sm mb-4 flex flex-wrap items-center gap-3 justify-between">
            <span>
              {unseeded.length} service{" "}
              {unseeded.length === 1 ? "area has" : "areas have"} no page yet:{" "}
              <span className="font-mono">
                {unseeded.map((area) => area.slug).join(", ")}
              </span>
            </span>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="bg-teal hover:bg-teal/90 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {seeding ? "Seeding…" : "Seed them"}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-6">
            {/* Keyed so switching pages remounts the form and its state is
                seeded from the new page rather than synced by an effect. */}
            <LandingPageForm
              key={editingPage?.path ?? "new"}
              page={editingPage}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <LandingPagesTable
            pages={pages}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
