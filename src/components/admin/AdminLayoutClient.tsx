"use client";

import AdminAuthCheck from "@/components/admin/AdminAuthCheck";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePathname } from "next/navigation";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Check if the current path is the login page
  const isLoginPage =
    pathname === "/admin/login" || pathname.includes("/admin/login");

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AdminAuthCheck>
      <AdminLayout>{children}</AdminLayout>
    </AdminAuthCheck>
  );
}
