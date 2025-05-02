"use client";

import { Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ContactsTable from "@/components/admin/ContactsTable";

export default function AdminContactsPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Contact Inquiries
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage customer contact form submissions
          </p>
        </div>

        <Suspense fallback={<div>Loading contacts...</div>}>
          <ContactsTable />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
