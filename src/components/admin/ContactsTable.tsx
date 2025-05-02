"use client";

import { useState, useEffect, useMemo } from "react";

type SortDirection = "asc" | "desc";
type SortConfig = {
  key: string;
  direction: SortDirection;
} | null;

type Contact = {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  message: string;
  status: "new" | "in-progress" | "completed" | "archived";
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type ContactTableColumn = {
  key: string;
  label: string;
  sortable: boolean;
};

const STATUS_OPTIONS = ["new", "in-progress", "completed", "archived"];

export default function ContactsTable() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  const columns: ContactTableColumn[] = [
    { key: "createdAt", label: "Date", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone", sortable: true },
    { key: "eventDate", label: "Event Date", sortable: true },
    { key: "message", label: "Message", sortable: false },
    { key: "status", label: "Status", sortable: true },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const handleSort = (key: string) => {
    setSortConfig((currentSort) => {
      if (!currentSort || currentSort.key !== key) {
        return { key, direction: "asc" };
      }
      if (currentSort.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((contact) => contact.status === statusFilter);
    }

    return filtered;
  }, [contacts, statusFilter]);

  const sortedContacts = useMemo(() => {
    if (!sortConfig) return filteredContacts;

    return [...filteredContacts].sort((a, b) => {
      // Get comparable values based on sort key
      const getComparableValue = (contact: Contact): string | number => {
        switch (sortConfig.key) {
          case "name":
          case "email":
          case "phone":
          case "status":
            return (
              contact[sortConfig.key as keyof Contact] as string
            ).toLowerCase();
          case "createdAt": {
            const date = contact[sortConfig.key];
            if (!date) return 0;
            try {
              const parsedDate = new Date(date);
              return !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
            } catch {
              return 0;
            }
          }
          case "eventDate": {
            const date = contact[sortConfig.key];
            if (!date) return 0;
            try {
              // Append T00:00:00 to interpret the date in local timezone
              const parsedDate = new Date(date + "T00:00:00");
              return !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
            } catch {
              return 0;
            }
          }
          default: {
            const value = contact[sortConfig.key as keyof Contact];
            return value ? String(value) : "";
          }
        }
      };

      const aValue = getComparableValue(a);
      const bValue = getComparableValue(b);

      return sortConfig.direction === "asc"
        ? aValue < bValue
          ? -1
          : aValue > bValue
            ? 1
            : 0
        : aValue > bValue
          ? -1
          : aValue < bValue
            ? 1
            : 0;
    });
  }, [filteredContacts, sortConfig]);

  // Get current page's contacts
  const currentContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedContacts.slice(startIndex, startIndex + pageSize);
  }, [sortedContacts, currentPage, pageSize]);

  useEffect(() => {
    fetchContacts();
  }, []);

  // Reset to first page when changing filters
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const fetchContacts = async () => {
    try {
      const response = await fetch("/api/admin/contacts");
      if (!response.ok) throw new Error("Failed to fetch contacts");
      const data = await response.json();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (contactId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      await fetchContacts(); // Refresh contacts
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!window.confirm("Are you sure you want to delete this contact?"))
      return;

    try {
      const response = await fetch(`/api/admin/contacts/${contactId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete contact");
      await fetchContacts(); // Refresh contacts
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact");
    }
  };

  if (loading)
    return (
      <div className="text-gray-600 dark:text-gray-300">
        Loading contacts...
      </div>
    );
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-light dark:bg-charcoal">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => column.sortable && handleSort(column.key)}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                    column.sortable
                      ? "cursor-pointer hover:text-gray-700 dark:hover:text-gray-100"
                      : ""
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="text-gray-400">
                        {sortConfig?.key === column.key &&
                          (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {currentContacts.map((contact) => (
              <tr
                key={contact._id?.toString()}
                className="hover:bg-light dark:hover:bg-charcoal transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {(() => {
                    try {
                      const date = new Date(contact.createdAt!);
                      if (isNaN(date.getTime())) {
                        return "N/A";
                      }
                      return date.toLocaleDateString();
                    } catch {
                      return "N/A";
                    }
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {contact.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {contact.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {contact.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {(() => {
                    try {
                      // Append T00:00:00 to interpret the date in local timezone
                      const date = new Date(contact.eventDate + "T00:00:00");
                      if (isNaN(date.getTime())) {
                        return contact.eventDate; // Return the raw string if date is invalid
                      }
                      return date.toLocaleDateString();
                    } catch {
                      return contact.eventDate; // Return the raw string if parsing fails
                    }
                  })()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  <div className="max-w-xs truncate">{contact.message}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={contact.status}
                    onChange={(e) =>
                      handleStatusChange(
                        contact._id!.toString(),
                        e.target.value,
                      )
                    }
                    className="text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                  <button
                    onClick={() => handleDelete(contact._id!.toString())}
                    className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1); // Reset to first page when changing page size
            }}
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {[25, 50, 100, 250].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>entries</span>
        </div>

        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing{" "}
          {Math.min((currentPage - 1) * pageSize + 1, sortedContacts.length)} to{" "}
          {Math.min(currentPage * pageSize, sortedContacts.length)} of{" "}
          {sortedContacts.length} entries
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page {currentPage} of {Math.ceil(sortedContacts.length / pageSize)}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(prev + 1, Math.ceil(sortedContacts.length / pageSize)),
              )
            }
            disabled={
              currentPage >= Math.ceil(sortedContacts.length / pageSize)
            }
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
