"use client";

import { Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import OrdersTable from "@/components/admin/OrdersTable";

export default function AdminOrdersPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Order Management
          </h1>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
        <Suspense fallback={<div>Loading orders...</div>}>
          <OrdersTable />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
