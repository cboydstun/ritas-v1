"use client";

import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { useState, useEffect } from "react";
import { MargaritaRental } from "@/types/index";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/orders");
      if (!response.ok) throw new Error("Failed to fetch orders");
      const orders: MargaritaRental[] = await response.json();

      const stats = orders.reduce(
        (acc, order) => {
          acc.totalOrders++;
          if (order.status === "pending") acc.pendingOrders++;
          if (order.status === "completed") acc.completedOrders++;
          if (order.payment?.status === "completed") {
            acc.totalRevenue += order.payment.amount;
          }
          return acc;
        },
        {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
        },
      );

      setStats(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-8">
          Admin Dashboard
        </h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Total Orders
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalOrders}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Pending Orders
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.pendingOrders}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Completed Orders
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.completedOrders}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Total Revenue
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${stats.totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/orders"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal transition-colors"
            >
              Manage Orders
            </Link>
            <Link
              href="/admin/contacts"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal transition-colors"
            >
              View Contacts
            </Link>
          </div>
        </div>

        {/* Recent Activity - Placeholder for future features */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Recent activity will be shown here in future updates.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
