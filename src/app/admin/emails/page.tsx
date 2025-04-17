import { Suspense } from "react";
import AdminAuthCheck from "@/components/admin/AdminAuthCheck";
import EmailsClient from "./components/EmailsClient";

export const metadata = {
  title: "Email Management - Admin Panel",
  description: "Manage email templates and view sent emails",
};

export default function EmailsPage() {
  return (
    <AdminAuthCheck>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
          Email Management
        </h1>

        <Suspense fallback={<div>Loading...</div>}>
          <EmailsClient />
        </Suspense>
      </div>
    </AdminAuthCheck>
  );
}
