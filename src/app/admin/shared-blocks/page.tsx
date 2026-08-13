"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SharedBlocksTable from "@/components/admin/SharedBlocksTable";
import type { SharedBlockRecord } from "@/lib/landing";

const SharedBlockForm = dynamic(
  () => import("@/components/admin/SharedBlockForm"),
  { ssr: false },
);

export default function SharedBlocksAdminPage() {
  const [blocks, setBlocks] = useState<SharedBlockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<SharedBlockRecord | null>(
    null,
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/shared-blocks");
      if (!response.ok) throw new Error("Failed to fetch shared blocks");

      setBlocks(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, [refreshTrigger]);

  /**
   * The list route keeps `sections` in its projection — the section picker
   * needs them — so unlike the landing-page table the row in hand is already
   * enough to open the editor.
   */
  const handleEdit = (block: SharedBlockRecord) => {
    setEditingBlock(block);
    setShowForm(true);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete "${slug}"?`)) return;

    try {
      const response = await fetch(`/api/admin/shared-blocks/${slug}`, {
        method: "DELETE",
      });

      // 409 means pages still insert this block, and the body names them. The
      // renderer would drop the reference silently, but that failsafe should
      // not be how an admin finds out.
      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        const force = confirm(
          `${data.message}\n\nDelete it anyway? Those pages will lose the section.`,
        );
        if (!force) return;

        const forced = await fetch(`/api/admin/shared-blocks/${slug}?force=1`, {
          method: "DELETE",
        });
        if (!forced.ok) throw new Error("Failed to delete the block");
      } else if (!response.ok) {
        throw new Error("Failed to delete the block");
      }

      setRefreshTrigger((previous) => previous + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingBlock(null);
    setRefreshTrigger((previous) => previous + 1);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Shared Blocks
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Sections written once and inserted into many landing pages. Edit
              the block and every page carrying it changes.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingBlock(null);
              setShowForm(true);
            }}
            className="bg-teal hover:bg-teal/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            New Block
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-6">
            <SharedBlockForm
              key={editingBlock?.slug ?? "new"}
              block={editingBlock}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowForm(false);
                setEditingBlock(null);
              }}
            />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <SharedBlocksTable
            blocks={blocks}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
