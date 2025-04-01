import ThemeWrapper from "@/components/ThemeWrapper";
import AdminLayoutClient from "@/components/admin/AdminLayoutClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard - SATX Ritas",
  description: "Admin dashboard for SATX Ritas Margarita Rentals",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeWrapper>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </ThemeWrapper>
  );
}
