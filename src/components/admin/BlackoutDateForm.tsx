"use client";

import { useState, useEffect } from "react";
import { BlackoutDateDocument, BlackoutDateType } from "@/models/blackout-date";

interface BlackoutDateFormProps {
  blackoutDate?: BlackoutDateDocument | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  startDate: string;
  endDate: string;
  reason: string;
  type: BlackoutDateType;
  startTime: string;
  endTime: string;
}

export default function BlackoutDateForm({
  blackoutDate,
  onSuccess,
  onCancel,
}: BlackoutDateFormProps) {
  const [formData, setFormData] = useState<FormData>({
    startDate: "",
    endDate: "",
    reason: "",
    type: "full_day",
    startTime: "08:00",
    endTime: "18:00",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to safely convert date to string for form input
  const dateToString = (date: Date | string | undefined): string => {
    if (!date) return "";

    let dateObj: Date;

    // If it's already a string, parse it carefully
    if (typeof date === "string") {
      if (date.includes("T")) {
        // ISO string with time
        dateObj = new Date(date);
      } else {
        // Date-only string - parse as local date to avoid timezone shifts
        const parts = date.includes("-") ? date.split("-") : date.split("/");
        if (parts.length === 3) {
          if (date.includes("-")) {
            // Format: YYYY-MM-DD
            const [year, month, day] = parts;
            dateObj = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
            );
          } else {
            // Format: MM/DD/YYYY
            const [month, day, year] = parts;
            dateObj = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
            );
          }
        } else {
          dateObj = new Date(date);
        }
      }
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return "";
    }

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return "";
    }

    // Format as YYYY-MM-DD for HTML date input using local time
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Populate form when editing
  useEffect(() => {
    if (blackoutDate) {
      setFormData({
        startDate: dateToString(blackoutDate.startDate),
        endDate: dateToString(blackoutDate.endDate),
        reason: blackoutDate.reason || "",
        type: blackoutDate.type,
        startTime: blackoutDate.startTime || "08:00",
        endTime: blackoutDate.endTime || "18:00",
      });
    }
  }, [blackoutDate]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.startDate) {
        throw new Error("Start date is required");
      }

      if (formData.type === "time_range") {
        if (!formData.startTime || !formData.endTime) {
          throw new Error(
            "Start time and end time are required for time range type",
          );
        }
        if (formData.startTime >= formData.endTime) {
          throw new Error("End time must be after start time");
        }
      }

      if (formData.endDate && formData.startDate > formData.endDate) {
        throw new Error("End date must be after start date");
      }

      // Prepare request body
      const requestBody = {
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        reason: formData.reason || undefined,
        type: formData.type,
        startTime:
          formData.type === "time_range" ? formData.startTime : undefined,
        endTime: formData.type === "time_range" ? formData.endTime : undefined,
      };

      // Make API request
      const url = blackoutDate
        ? `/api/admin/blackout-dates/${blackoutDate._id}`
        : "/api/admin/blackout-dates";

      const method = blackoutDate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save blackout date");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {blackoutDate ? "Edit Blackout Date" : "Add Blackout Date"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date (Optional)
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty for single day blackout
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Blackout Type *
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
          >
            <option value="full_day">Full Day</option>
            <option value="time_range">Time Range</option>
          </select>
        </div>

        {formData.type === "time_range" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time *
              </label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason (Optional)
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            rows={3}
            maxLength={500}
            placeholder="e.g., Holiday - No Deliveries, Maintenance Day, Staff Training"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal focus:border-teal dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formData.reason.length}/500 characters
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-teal hover:bg-teal/90 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : blackoutDate ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
