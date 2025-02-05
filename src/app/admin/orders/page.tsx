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
        </div>
        <Suspense fallback={<div>Loading orders...</div>}>
          <OrdersTable />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
