"use client";

import { useState, useEffect } from "react";
import { MargaritaRental, RentalStatus, PaymentStatus } from "@/types/index";
import { OrderTableColumn } from "@/types/admin";
import EditOrderModal from "./EditOrderModal";

export default function OrdersTable() {
  const [orders, setOrders] = useState<MargaritaRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<MargaritaRental | null>(
    null
  );

  const columns: OrderTableColumn[] = [
    { key: "createdAt", label: "Order Date" },
    { key: "customer", label: "Customer" },
    { key: "machineType", label: "Machine" },
    { key: "rentalDate", label: "Rental Date" },
    { key: "status", label: "Status" },
    { key: "payment", label: "Payment" },
    { key: "actions", label: "Actions" },
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

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
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <thead className="bg-light dark:bg-charcoal">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map((order) => (
            <tr
              key={order._id?.toString()}
              className="hover:bg-light dark:hover:bg-charcoal transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {new Date(order.createdAt!).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {order.customer.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {order.machineType} ({order.capacity}L)
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {new Date(order.rentalDate).toLocaleDateString()}
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
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
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
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                <button
                  onClick={() => handleEdit(order)}
                  className="text-teal hover:text-teal-700 transition-colors"
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
  );
}
