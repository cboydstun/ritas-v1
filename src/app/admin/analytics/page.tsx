"use client";

import AdminLayout from "@/components/admin/AdminLayout";
import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";

// Define types for analytics data
interface AnalyticsItem {
  _id: string;
  count: number;
}

interface AnalyticsData {
  totalVisitors: number;
  newVisitorsLast30Days: number;
  deviceBreakdown: AnalyticsItem[];
  dailyVisits: AnalyticsItem[];
  topPages: AnalyticsItem[];
}

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/analytics");
      
      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }
      
      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const prepareVisitorChartData = () => {
    if (!analyticsData?.dailyVisits) return null;
    
    const labels = analyticsData.dailyVisits.map((item: AnalyticsItem) => item._id);
    const data = analyticsData.dailyVisits.map((item: AnalyticsItem) => item.count);
    
    return {
      labels,
      datasets: [
        {
          label: "Daily Visitors",
          data,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          tension: 0.1,
        },
      ],
    };
  };
  
  const prepareDeviceChartData = () => {
    if (!analyticsData?.deviceBreakdown) return null;
    
    const labels = analyticsData.deviceBreakdown.map((item: AnalyticsItem) => item._id);
    const data = analyticsData.deviceBreakdown.map((item: AnalyticsItem) => item.count);
    
    return {
      labels,
      datasets: [
        {
          label: "Device Types",
          data,
          backgroundColor: [
            "rgba(255, 99, 132, 0.5)",
            "rgba(54, 162, 235, 0.5)",
            "rgba(255, 206, 86, 0.5)",
            "rgba(75, 192, 192, 0.5)",
          ],
          borderColor: [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };
  };
  
  const prepareTopPagesChartData = () => {
    if (!analyticsData?.topPages) return null;
    
    const labels = analyticsData.topPages.map((item: AnalyticsItem) => {
      // Truncate long page paths
      const page = item._id;
      return page.length > 20 ? page.substring(0, 17) + "..." : page;
    });
    const data = analyticsData.topPages.map((item: AnalyticsItem) => item.count);
    
    return {
      labels,
      datasets: [
        {
          label: "Page Views",
          data,
          backgroundColor: "rgba(153, 102, 255, 0.5)",
          borderColor: "rgb(153, 102, 255)",
          borderWidth: 1,
        },
      ],
    };
  };

  const visitorChartData = prepareVisitorChartData();
  const deviceChartData = prepareDeviceChartData();
  const topPagesChartData = prepareTopPagesChartData();

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-8">
          Analytics Dashboard
        </h1>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500 dark:text-gray-400">Loading analytics data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-8">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && analyticsData && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  Total Visitors
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analyticsData.totalVisitors}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  New Visitors (Last 30 Days)
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analyticsData.newVisitorsLast30Days}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  Conversion Rate
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  Coming Soon
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Daily Visitors Chart */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Daily Visitors (Last 30 Days)
                </h2>
                <div className="h-80">
                  {visitorChartData ? (
                    <Line
                      data={visitorChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              precision: 0,
                            },
                          },
                        },
                      }}
                    />
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No data available</p>
                  )}
                </div>
              </div>

              {/* Device Breakdown Chart */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Device Breakdown
                </h2>
                <div className="h-80 flex items-center justify-center">
                  {deviceChartData ? (
                    <Pie
                      data={deviceChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Pages Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Top Pages
              </h2>
              <div className="h-80">
                {topPagesChartData ? (
                  <Bar
                    data={topPagesChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: "y" as const,
                    }}
                  />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No data available</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
