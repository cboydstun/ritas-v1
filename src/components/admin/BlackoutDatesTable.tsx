"use client";

import {
  BlackoutDateDocument,
  formatDateForCentralTime,
} from "@/models/blackout-date";

interface BlackoutDatesTableProps {
  blackoutDates: BlackoutDateDocument[];
  loading: boolean;
  onEdit: (blackoutDate: BlackoutDateDocument) => void;
  onDelete: (id: string) => void;
}

export default function BlackoutDatesTable({
  blackoutDates,
  loading,
  onEdit,
  onDelete,
}: BlackoutDatesTableProps) {
  const formatDate = (date: Date) => {
    return formatDateForCentralTime(date);
  };

  const formatTime = (time?: string) => {
    if (!time) return "N/A";

    // Convert 24-hour format to 12-hour format
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTypeDisplay = (
    type: string,
    startTime?: string,
    endTime?: string,
  ) => {
    if (type === "full_day") {
      return "Full Day";
    } else if (type === "time_range" && startTime && endTime) {
      return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    }
    return type;
  };

  const getDateRangeDisplay = (startDate: Date, endDate?: Date) => {
    const start = formatDate(startDate);
    if (!endDate) {
      return start;
    }
    const end = formatDate(endDate);
    return start === end ? start : `${start} - ${end}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (blackoutDates.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500 dark:text-gray-400">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No blackout dates
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first blackout date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Date Range
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Reason
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Created By
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {blackoutDates.map((blackoutDate) => (
            <tr
              key={blackoutDate._id?.toString()}
              className="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {getDateRangeDisplay(
                  blackoutDate.startDate,
                  blackoutDate.endDate,
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    blackoutDate.type === "full_day"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                  }`}
                >
                  {getTypeDisplay(
                    blackoutDate.type,
                    blackoutDate.startTime,
                    blackoutDate.endTime,
                  )}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                <div
                  className="max-w-xs truncate"
                  title={blackoutDate.reason || "No reason provided"}
                >
                  {blackoutDate.reason || "No reason provided"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {blackoutDate.createdBy}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {formatDate(blackoutDate.createdAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => onEdit(blackoutDate)}
                    className="text-teal hover:text-teal/80 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(blackoutDate._id?.toString() || "")}
                    className="text-red-600 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
