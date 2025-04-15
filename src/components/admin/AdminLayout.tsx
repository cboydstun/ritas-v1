import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import SignOutButton from "@/components/admin/SignOutButton";
import { useState } from "react";
import { useSession } from "next-auth/react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-light dark:bg-charcoal">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Admin Panel
          </h2>
        </div>
        <nav className="mt-6">
          <Link
            href="/admin"
            className="block px-6 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/orders"
            className="block px-6 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Orders
          </Link>
          <Link
            href="/admin/analytics"
            className="block px-6 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Analytics
          </Link>
          <Link
            href="/"
            className="block px-6 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Site
          </Link>
        </nav>

        <div className="absolute bottom-0 left-0 right-0">
          {/* User info and sign out */}
          {session && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white">
                    {session.user?.name?.charAt(0) || "A"}
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {session.user?.name || "Admin"}
                  </div>
                </div>
                <SignOutButton />
              </div>
            </div>
          )}

          {/* Toggle sidebar and theme */}
          <div className="p-6 flex items-center border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-light hover:bg-gray-100 dark:bg-charcoal dark:hover:bg-gray-800 transition-all duration-300"
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <svg
                className="w-6 h-6 text-margarita hover:text-teal transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main content */}
      {/* Toggle button for collapsed state */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-6 left-6 z-40 p-2 rounded-lg bg-light hover:bg-gray-100 dark:bg-charcoal dark:hover:bg-gray-800 transition-all duration-300"
          aria-label="Open sidebar"
        >
          <svg
            className="w-6 h-6 text-margarita hover:text-teal transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      <main
        className={`transition-all duration-300 ${isSidebarOpen ? "ml-64" : "ml-0"} min-h-screen`}
      >
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
