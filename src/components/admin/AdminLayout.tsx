import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-light dark:bg-charcoal">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
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
            href="/"
            className="block px-6 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Site
          </Link>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
