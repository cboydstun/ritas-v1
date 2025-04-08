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
  orderSteps: Array<{
    _id: string;
    count: number;
    uniqueVisitors: number;
    avgTimeSpent: number;
    totalTimeSpent: number;
  }>;
  funnelMetrics: {
    totalFunnels: number;
    completedFunnels: number;
    abandonedFunnels: number;
    conversionRate: number;
  };
  stepAbandonment: Array<{
    _id: string;
    count: number;
  }>;
  visitsByDayOfWeek: Array<{
    _id: number;
    count: number;
    uniqueVisitors: number;
  }>;
  visitsByHourOfDay: Array<{
    _id: number;
    count: number;
    uniqueVisitors: number;
  }>;
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
  
  const prepareOrderStepsChartData = () => {
    if (!analyticsData?.orderSteps || analyticsData.orderSteps.length === 0) return null;
    
    // Map step IDs to readable names
    const stepNames: Record<string, string> = {
      "/order/delivery": "1. Delivery",
      "/order/details": "2. Details",
      "/order/extras": "3. Extras",
      "/order/review": "4. Review",
      "/order/payment": "5. Payment"
    };
    
    const labels = analyticsData.orderSteps.map(item => stepNames[item._id] || item._id);
    const data = analyticsData.orderSteps.map(item => item.uniqueVisitors);
    
    return {
      labels,
      datasets: [
        {
          label: "Unique Visitors",
          data,
          backgroundColor: "rgba(255, 159, 64, 0.5)",
          borderColor: "rgb(255, 159, 64)",
          borderWidth: 1,
        },
      ],
    };
  };

  const prepareTimeSpentChartData = () => {
    if (!analyticsData?.orderSteps || analyticsData.orderSteps.length === 0) return null;
    
    // Map step IDs to readable names
    const stepNames: Record<string, string> = {
      "/order/delivery": "1. Delivery",
      "/order/details": "2. Details",
      "/order/extras": "3. Extras",
      "/order/review": "4. Review",
      "/order/payment": "5. Payment"
    };
    
    const labels = analyticsData.orderSteps.map(item => stepNames[item._id] || item._id);
    const data = analyticsData.orderSteps.map(item => item.avgTimeSpent / 1000); // Convert to seconds
    
    return {
      labels,
      datasets: [
        {
          label: "Avg. Time Spent (seconds)",
          data,
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          borderColor: "rgb(75, 192, 192)",
          borderWidth: 1,
        },
      ],
    };
  };

  const prepareStepAbandonmentChartData = () => {
    if (!analyticsData?.stepAbandonment || analyticsData.stepAbandonment.length === 0) return null;
    
    // Map step IDs to readable names
    const stepNames: Record<string, string> = {
      "delivery": "1. Delivery",
      "details": "2. Details",
      "extras": "3. Extras",
      "review": "4. Review",
      "payment": "5. Payment"
    };
    
    const labels = analyticsData.stepAbandonment.map(item => stepNames[item._id] || item._id);
    const data = analyticsData.stepAbandonment.map(item => item.count);
    
    return {
      labels,
      datasets: [
        {
          label: "Abandonment Count",
          data,
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgb(255, 99, 132)",
          borderWidth: 1,
        },
      ],
    };
  };

  // Day of week chart preparation
  const prepareDayOfWeekChartData = () => {
    if (!analyticsData?.visitsByDayOfWeek) return null;
    
    // Map numeric days to names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Sort by day of week (MongoDB returns 1-7 where 1=Sunday)
    const sortedData = [...analyticsData.visitsByDayOfWeek]
      .sort((a, b) => a._id - b._id)
      .map(item => ({
        ...item,
        // MongoDB's $dayOfWeek returns 1-7 where 1=Sunday, so we adjust to 0-6 for array index
        dayName: dayNames[item._id - 1]
      }));
    
    return {
      labels: sortedData.map(item => item.dayName),
      datasets: [
        {
          label: "Visits by Day of Week",
          data: sortedData.map(item => item.count),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgb(54, 162, 235)",
          borderWidth: 1,
        },
      ],
    };
  };

  // Hour of day chart preparation
  const prepareHourOfDayChartData = () => {
    if (!analyticsData?.visitsByHourOfDay) return null;
    
    // Format hours in 12-hour format with AM/PM
    const formatHour = (hour: number) => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };
    
    // Sort by hour
    const sortedData = [...analyticsData.visitsByHourOfDay]
      .sort((a, b) => a._id - b._id)
      .map(item => ({
        ...item,
        hourFormatted: formatHour(item._id)
      }));
    
    return {
      labels: sortedData.map(item => item.hourFormatted),
      datasets: [
        {
          label: "Visits by Hour of Day",
          data: sortedData.map(item => item.count),
          backgroundColor: "rgba(255, 206, 86, 0.5)",
          borderColor: "rgb(255, 206, 86)",
          borderWidth: 1,
        },
      ],
    };
  };

  const visitorChartData = prepareVisitorChartData();
  const deviceChartData = prepareDeviceChartData();
  const topPagesChartData = prepareTopPagesChartData();
  const orderStepsChartData = prepareOrderStepsChartData();
  const timeSpentChartData = prepareTimeSpentChartData();
  const stepAbandonmentChartData = prepareStepAbandonmentChartData();
  const dayOfWeekChartData = prepareDayOfWeekChartData();
  const hourOfDayChartData = prepareHourOfDayChartData();

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
                  {analyticsData.funnelMetrics?.conversionRate?.toFixed(2)}%
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {analyticsData.funnelMetrics?.completedFunnels} completed / {analyticsData.funnelMetrics?.totalFunnels} total
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
            
            {/* Order Form Funnel Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                Order Form Analytics
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Order Form Steps Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Order Form Funnel
                  </h2>
                  <div className="h-80">
                    {orderStepsChartData ? (
                      <Bar
                        data={orderStepsChartData}
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
                      <p className="text-gray-500 dark:text-gray-400">No order form data available</p>
                    )}
                  </div>
                </div>
                
                {/* Time Spent Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Time Spent on Each Step
                  </h2>
                  <div className="h-80">
                    {timeSpentChartData ? (
                      <Bar
                        data={timeSpentChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Seconds'
                              }
                            },
                          },
                        }}
                      />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No time data available</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Step Abandonment Chart */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Form Abandonment by Step
                </h2>
                <div className="h-80">
                  {stepAbandonmentChartData ? (
                    <Bar
                      data={stepAbandonmentChartData}
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
                    <p className="text-gray-500 dark:text-gray-400">No abandonment data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Time-Based Analytics Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                Visit Timing Analytics
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Day of Week Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Visits by Day of Week
                  </h2>
                  <div className="h-80">
                    {dayOfWeekChartData ? (
                      <Bar
                        data={dayOfWeekChartData}
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
                
                {/* Hour of Day Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Visits by Time of Day
                  </h2>
                  <div className="h-80">
                    {hourOfDayChartData ? (
                      <Bar
                        data={hourOfDayChartData}
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
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
