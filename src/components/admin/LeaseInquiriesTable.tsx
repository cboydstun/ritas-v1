"use client";

import { useState, useEffect, useMemo } from "react";
import { leaseTiers, type LeaseTierId } from "@/lib/lease-data";

type SortDirection = "asc" | "desc";
type SortConfig = {
  key: string;
  direction: SortDirection;
} | null;

type LeaseInquiry = {
  _id?: string;
  businessName: string;
  businessType: string;
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  preferredTerm: string;
  machinesOfInterest: LeaseTierId[];
  message: string;
  status: "new" | "contacted" | "qualified" | "won" | "lost" | "archived";
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type LeaseInquiryColumn = {
  key: string;
  label: string;
  sortable: boolean;
};

const STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
  "archived",
];

const tierNameById = (id: string) =>
  leaseTiers.find((t) => t.id === (id as LeaseTierId))?.name ?? id;

export default function LeaseInquiriesTable() {
  const [inquiries, setInquiries] = useState<LeaseInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  const columns: LeaseInquiryColumn[] = [
    { key: "createdAt", label: "Date", sortable: true },
    { key: "businessName", label: "Business", sortable: true },
    { key: "businessType", label: "Type", sortable: true },
    { key: "contactName", label: "Contact", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone", sortable: true },
    { key: "preferredTerm", label: "Term", sortable: true },
    { key: "machinesOfInterest", label: "Machines", sortable: false },
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

  const filteredInquiries = useMemo(() => {
    let filtered = inquiries;
    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    return filtered;
  }, [inquiries, statusFilter]);

  const sortedInquiries = useMemo(() => {
    if (!sortConfig) return filteredInquiries;

    return [...filteredInquiries].sort((a, b) => {
      const getComparableValue = (i: LeaseInquiry): string | number => {
        switch (sortConfig.key) {
          case "businessName":
          case "businessType":
          case "contactName":
          case "email":
          case "phone":
          case "preferredTerm":
          case "status":
            return (
              i[sortConfig.key as keyof LeaseInquiry] as string
            ).toLowerCase();
          case "createdAt": {
            const date = i[sortConfig.key];
            if (!date) return 0;
            try {
              const parsedDate = new Date(date);
              return !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
            } catch {
              return 0;
            }
          }
          default: {
            const value = i[sortConfig.key as keyof LeaseInquiry];
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
  }, [filteredInquiries, sortConfig]);

  const currentInquiries = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedInquiries.slice(startIndex, startIndex + pageSize);
  }, [sortedInquiries, currentPage, pageSize]);

  useEffect(() => {
    fetchInquiries();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const fetchInquiries = async () => {
    try {
      const response = await fetch("/api/admin/lease-inquiries");
      if (!response.ok) throw new Error("Failed to fetch lease inquiries");
      const data = await response.json();
      setInquiries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/lease-inquiries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      await fetchInquiries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this lease inquiry?"))
      return;

    try {
      const response = await fetch(`/api/admin/lease-inquiries/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete lease inquiry");
      await fetchInquiries();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete lease inquiry",
      );
    }
  };

  if (loading)
    return (
      <div className="text-gray-600 dark:text-gray-300">
        Loading lease inquiries...
      </div>
    );
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-4">
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
            {currentInquiries.map((inquiry) => (
              <tr
                key={inquiry._id?.toString()}
                className="hover:bg-light dark:hover:bg-charcoal transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {(() => {
                    try {
                      const date = new Date(inquiry.createdAt!);
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
                  {inquiry.businessName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {inquiry.businessType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {inquiry.contactName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {inquiry.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {inquiry.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {inquiry.preferredTerm}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  <div className="max-w-xs truncate">
                    {(inquiry.machinesOfInterest ?? [])
                      .map(tierNameById)
                      .join(", ") || "—"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={inquiry.status}
                    onChange={(e) =>
                      handleStatusChange(
                        inquiry._id!.toString(),
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
                    onClick={() => handleDelete(inquiry._id!.toString())}
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

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
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
          {Math.min((currentPage - 1) * pageSize + 1, sortedInquiries.length)}{" "}
          to {Math.min(currentPage * pageSize, sortedInquiries.length)} of{" "}
          {sortedInquiries.length} entries
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
            Page {currentPage} of{" "}
            {Math.ceil(sortedInquiries.length / pageSize) || 1}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(
                  prev + 1,
                  Math.ceil(sortedInquiries.length / pageSize),
                ),
              )
            }
            disabled={
              currentPage >= Math.ceil(sortedInquiries.length / pageSize)
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
