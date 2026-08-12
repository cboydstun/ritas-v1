"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import OrdersTable from "@/components/admin/OrdersTable";
// Conditionally mounted and most admin sessions never open it, so it does not
// belong in the eagerly-loaded admin bundle — the same treatment
// AnalyticsCharts already gets.
const CreateOrderModal = dynamic(
  () => import("@/components/admin/CreateOrderModal"),
  { ssr: false },
);

export default function AdminOrdersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Order Management
          </h1>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-teal hover:bg-teal-700 text-white rounded-md transition-colors"
          >
            Create New Order
          </button>
        </div>

        {isCreateModalOpen && (
          <CreateOrderModal onClose={() => setIsCreateModalOpen(false)} />
        )}
        <Suspense fallback={<div>Loading orders...</div>}>
          <OrdersTable />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
