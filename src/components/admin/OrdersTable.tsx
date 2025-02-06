"use client";

import { useState, useEffect, useMemo } from "react";
import { MargaritaRental, RentalStatus, PaymentStatus } from "@/types/index";
import { OrderTableColumn } from "@/types/admin";
import EditOrderModal from "./EditOrderModal";

type SortDirection = "asc" | "desc";
type SortConfig = {
  key: string;
  direction: SortDirection;
} | null;

type DateFilter =
  | "all"
  | "this-week"
  | "next-week"
  | "this-month"
  | "next-month";

const STATUS_OPTIONS: RentalStatus[] = [
  "pending",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
];

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  "pending",
  "completed",
  "failed",
  "refunded",
];

export default function OrdersTable() {
  const [orders, setOrders] = useState<MargaritaRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<MargaritaRental | null>(
    null
  );
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RentalStatus>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    "all" | PaymentStatus
  >("all");

  const columns: OrderTableColumn[] = [
    { key: "createdAt", label: "Order Date", sortable: true },
    { key: "customer", label: "Customer", sortable: true },
    { key: "machineType", label: "Machine", sortable: true },
    { key: "selectedMixers", label: "Mixers", sortable: true },
    { key: "rentalDate", label: "Rental Date", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "payment", label: "Payment", sortable: true },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const uniqueMachineTypes = useMemo(() => {
    const types = new Set(orders.map((order) => order.machineType));
    return ["all", ...Array.from(types)];
  }, [orders]);

  const getDateRange = (
    filter: DateFilter
  ): { start: Date; end: Date } | null => {
    if (filter === "all") return null;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    switch (filter) {
      case "this-week": {
        const end = new Date(startOfWeek);
        end.setDate(startOfWeek.getDate() + 6);
        return { start: startOfWeek, end };
      }
      case "next-week": {
        const start = new Date(startOfWeek);
        start.setDate(startOfWeek.getDate() + 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start, end };
      }
      case "this-month":
        return {
          start: startOfMonth,
          end: new Date(startOfNextMonth.getTime() - 1),
        };
      case "next-month":
        return {
          start: startOfNextMonth,
          end: endOfNextMonth,
        };
      default:
        return null;
    }
  };

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

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Apply rental date filter
    const dateRange = getDateRange(dateFilter);
    if (dateRange) {
      filtered = filtered.filter((order) => {
        try {
          // Append T00:00:00 to interpret the date in local timezone
          const rentalDate = new Date(order.rentalDate + "T00:00:00");
          return (
            !isNaN(rentalDate.getTime()) &&
            rentalDate >= dateRange.start &&
            rentalDate <= dateRange.end
          );
        } catch {
          return false; // Exclude invalid dates from filter results
        }
      });
    }

    // Apply machine filter
    if (machineFilter !== "all") {
      filtered = filtered.filter(
        (order) => order.machineType === machineFilter
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Apply payment status filter
    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter(
        (order) => order.payment?.status === paymentStatusFilter
      );
    }

    return filtered;
  }, [orders, dateFilter, machineFilter, statusFilter, paymentStatusFilter]);

  const sortedOrders = useMemo(() => {
    if (!sortConfig) return filteredOrders;

    return [...filteredOrders].sort((a, b) => {
      // Get comparable values based on sort key
      const getComparableValue = (order: MargaritaRental): string | number => {
        switch (sortConfig.key) {
          case "customer":
            return order.customer.name.toLowerCase();
          case "payment":
            return order.payment?.status || "pending";
          case "createdAt": {
            const date = order[sortConfig.key];
            if (!date) return 0;
            try {
              const parsedDate = new Date(date);
              return !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
            } catch {
              return 0;
            }
          }
          case "rentalDate": {
            const date = order[sortConfig.key];
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
            const value = order[sortConfig.key as keyof MargaritaRental];
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
  }, [filteredOrders, sortConfig]);

  // Get current page's orders
  const currentOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedOrders.slice(startIndex, startIndex + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Reset to first page when changing filters
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, machineFilter, statusFilter, paymentStatusFilter]);

  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/admin/orders");
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: RentalStatus
  ) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      await fetchOrders(); // Refresh orders
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handlePaymentStatusChange = async (
    orderId: string,
    newStatus: PaymentStatus
  ) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment: { status: newStatus },
        }),
      });

      if (!response.ok) throw new Error("Failed to update payment status");
      await fetchOrders(); // Refresh orders
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update payment status"
      );
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to delete this order?")) return;

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete order");
      await fetchOrders(); // Refresh orders
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  const handleEdit = (order: MargaritaRental) => {
    setEditingOrder(order);
  };

  const handleSaveEdit = async (
    orderId: string,
    data: Partial<MargaritaRental>
  ) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update order");
      await fetchOrders(); // Refresh orders
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  };

  if (loading)
    return (
      <div className="text-gray-600 dark:text-gray-300">Loading orders...</div>
    );
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Rental Date:
          </label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Time</option>
            <option value="this-week">This Week</option>
            <option value="next-week">Next Week</option>
            <option value="this-month">This Month</option>
            <option value="next-month">Next Month</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Machine Type:
          </label>
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {uniqueMachineTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All Machines" : type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | RentalStatus)
            }
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

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Payment:
          </label>
          <select
            value={paymentStatusFilter}
            onChange={(e) =>
              setPaymentStatusFilter(e.target.value as "all" | PaymentStatus)
            }
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Payments</option>
            {PAYMENT_STATUS_OPTIONS.map((status) => (
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
            {currentOrders.map((order) => (
              <tr
                key={order._id?.toString()}
                className="hover:bg-light dark:hover:bg-charcoal transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {(() => {
                    try {
                      const date = new Date(order.createdAt!);
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
                  {order.customer.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {order.machineType} ({order.capacity}L)
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {order.selectedMixers?.length > 0
                    ? order.selectedMixers.join(", ")
                    : "None"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {(() => {
                    try {
                      // Append T00:00:00 to interpret the date in local timezone
                      const date = new Date(order.rentalDate + "T00:00:00");
                      if (isNaN(date.getTime())) {
                        return order.rentalDate; // Return the raw string if date is invalid
                      }
                      return date.toLocaleDateString();
                    } catch {
                      return order.rentalDate; // Return the raw string if parsing fails
                    }
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleStatusChange(
                        order._id!.toString(),
                        e.target.value as RentalStatus
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={order.payment?.status}
                    onChange={(e) =>
                      handlePaymentStatusChange(
                        order._id!.toString(),
                        e.target.value as PaymentStatus
                      )
                    }
                    className="text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {PAYMENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                  <button
                    onClick={() => handleEdit(order)}
                    className="text-teal hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(order._id!.toString())}
                    className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editingOrder && (
          <EditOrderModal
            order={editingOrder}
            onClose={() => setEditingOrder(null)}
            onSave={handleSaveEdit}
          />
        )}
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
          {Math.min((currentPage - 1) * pageSize + 1, sortedOrders.length)} to{" "}
          {Math.min(currentPage * pageSize, sortedOrders.length)} of{" "}
          {sortedOrders.length} entries
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
            Page {currentPage} of {Math.ceil(sortedOrders.length / pageSize)}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(prev + 1, Math.ceil(sortedOrders.length / pageSize))
              )
            }
            disabled={currentPage >= Math.ceil(sortedOrders.length / pageSize)}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
