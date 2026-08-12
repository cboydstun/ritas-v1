import SessionProvider from "@/components/SessionProvider";
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
  // SessionProvider is scoped here rather than to the root layout: every
  // useSession/signIn/signOut caller in the app is an admin component, and
  // wrapping the whole tree shipped next-auth/react to every public page.
  //
  // ThemeWrapper is deliberately absent — the root layout already renders one
  // and next-themes providers do not nest usefully.
  return (
    <SessionProvider>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </SessionProvider>
  );
}
