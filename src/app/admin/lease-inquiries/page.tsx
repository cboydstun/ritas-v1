"use client";

import { Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import LeaseInquiriesTable from "@/components/admin/LeaseInquiriesTable";

export default function AdminLeaseInquiriesPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Lease Inquiries
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage long-term lease inquiry submissions
          </p>
        </div>

        <Suspense fallback={<div>Loading lease inquiries...</div>}>
          <LeaseInquiriesTable />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
