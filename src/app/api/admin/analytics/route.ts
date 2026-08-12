import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Thumbprint } from "@/models/thumbprint";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Assert the admin role too, matching every other admin route — a session
    // alone would be enough here the moment a second provider is added.
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Get basic stats
    const totalVisitorsPromise = Thumbprint.countDocuments();
    const newVisitorsLast30DaysPromise = Thumbprint.countDocuments({
      firstSeen: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    // Get device breakdown
    const deviceBreakdownPromise = Thumbprint.aggregate([
      {
        $group: {
          _id: "$device.type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get daily visitors for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Every aggregation below narrows the document set *before* $unwind.
    // Unwinding first materialised up to MAX_RETAINED_VISITS (200) rows per
    // visitor across the whole collection and made the timestamp filter
    // unindexable — the filter ran after the fan-out rather than before it.
    const recentVisitors = { "visits.timestamp": { $gte: thirtyDaysAgo } };

    const dailyVisitsPromise = Thumbprint.aggregate([
      { $match: recentVisitors },
      {
        $unwind: "$visits",
      },
      {
        $match: {
          "visits.timestamp": { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$visits.timestamp" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get top pages
    const topPagesPromise = Thumbprint.aggregate([
      { $match: recentVisitors },
      {
        $unwind: "$visits",
      },
      { $match: { "visits.timestamp": { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: "$visits.page",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Get order form step completion rates with time spent
    const orderStepsPromise = Thumbprint.aggregate([
      // The note above claims every aggregation narrows before $unwind. This
      // one did not: it fanned the whole collection out to one row per
      // retained visit and only then filtered.
      {
        $match: { "visits.page": { $regex: "^/order/" } },
      },
      {
        $unwind: "$visits",
      },
      {
        $match: {
          "visits.page": { $regex: "^/order/" },
        },
      },
      {
        $group: {
          _id: "$visits.page",
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$fingerprintHash" },
          avgTimeSpent: { $avg: "$visits.timeSpentMs" },
          totalTimeSpent: { $sum: "$visits.timeSpentMs" },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueVisitors: { $size: "$uniqueVisitors" },
          avgTimeSpent: 1,
          totalTimeSpent: 1,
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get funnel completion metrics
    const funnelMetricsPromise = Thumbprint.aggregate([
      {
        $match: {
          funnelData: { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalFunnels: { $sum: 1 },
          completedFunnels: {
            $sum: {
              $cond: [{ $eq: ["$conversion.hasConverted", true] }, 1, 0],
            },
          },
          abandonedFunnels: {
            $sum: {
              $cond: [{ $eq: ["$conversion.hasConverted", true] }, 0, 1],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalFunnels: 1,
          completedFunnels: 1,
          abandonedFunnels: 1,
          conversionRate: {
            $multiply: [
              {
                $divide: ["$completedFunnels", { $max: ["$totalFunnels", 1] }],
              },
              100,
            ],
          },
        },
      },
    ]);

    // Get step abandonment data
    const stepAbandonmentPromise = Thumbprint.aggregate([
      {
        $match: {
          "funnelData.exitStep": { $exists: true },
          "conversion.hasConverted": { $ne: true },
        },
      },
      {
        $group: {
          _id: "$funnelData.exitStep",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Get visits by day of week (1 = Sunday, 7 = Saturday in MongoDB)
    const visitsByDayOfWeekPromise = Thumbprint.aggregate([
      { $match: recentVisitors },
      { $unwind: "$visits" },
      { $match: { "visits.timestamp": { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dayOfWeek: "$visits.timestamp" },
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$fingerprintHash" },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueVisitors: { $size: "$uniqueVisitors" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get visits by hour of day (0-23)
    const visitsByHourOfDayPromise = Thumbprint.aggregate([
      { $match: recentVisitors },
      { $unwind: "$visits" },
      { $match: { "visits.timestamp": { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $hour: "$visits.timestamp" },
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$fingerprintHash" },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueVisitors: { $size: "$uniqueVisitors" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // All ten reads are independent, so awaiting them in sequence cost the
    // sum of their latencies rather than the max. Nothing here feeds
    // anything else.
    const [
      totalVisitors,
      newVisitorsLast30Days,
      deviceBreakdown,
      dailyVisits,
      topPages,
      orderSteps,
      funnelMetrics,
      stepAbandonment,
      visitsByDayOfWeek,
      visitsByHourOfDay,
    ] = await Promise.all([
      totalVisitorsPromise,
      newVisitorsLast30DaysPromise,
      deviceBreakdownPromise,
      dailyVisitsPromise,
      topPagesPromise,
      orderStepsPromise,
      funnelMetricsPromise,
      stepAbandonmentPromise,
      visitsByDayOfWeekPromise,
      visitsByHourOfDayPromise,
    ]);

    return NextResponse.json({
      totalVisitors,
      newVisitorsLast30Days,
      deviceBreakdown,
      dailyVisits,
      topPages,
      orderSteps,
      funnelMetrics: funnelMetrics[0] || {
        totalFunnels: 0,
        completedFunnels: 0,
        abandonedFunnels: 0,
        conversionRate: 0,
      },
      stepAbandonment,
      visitsByDayOfWeek,
      visitsByHourOfDay,
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 },
    );
  }
}
