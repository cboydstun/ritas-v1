"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import AdminAuthCheck from "@/components/admin/AdminAuthCheck";
import BlackoutDatesTable from "@/components/admin/BlackoutDatesTable";
import BlackoutDateForm from "@/components/admin/BlackoutDateForm";
import { BlackoutDateDocument } from "@/models/blackout-date";

export default function BlackoutDatesPage() {
  const { data: session } = useSession();
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDateDocument[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState<BlackoutDateDocument | null>(
    null,
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch blackout dates
  const fetchBlackoutDates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/blackout-dates");

      if (!response.ok) {
        throw new Error("Failed to fetch blackout dates");
      }

      const data = await response.json();
      setBlackoutDates(data.blackoutDates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Refresh data when component mounts or refresh trigger changes
  useEffect(() => {
    fetchBlackoutDates();
  }, [refreshTrigger]);

  const handleCreate = () => {
    setEditingDate(null);
    setShowForm(true);
  };

  const handleEdit = (blackoutDate: BlackoutDateDocument) => {
    setEditingDate(blackoutDate);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blackout date?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/blackout-dates/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete blackout date");
      }

      // Refresh the list
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete blackout date",
      );
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingDate(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingDate(null);
  };

  return (
    <AdminAuthCheck>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Blackout Dates Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage dates when rentals are not available
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-teal hover:bg-teal/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Add Blackout Date
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-6">
            <BlackoutDateForm
              blackoutDate={editingDate}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <BlackoutDatesTable
            blackoutDates={blackoutDates}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </AdminAuthCheck>
  );
}
