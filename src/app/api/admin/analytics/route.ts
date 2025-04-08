import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Thumbprint } from "@/models/thumbprint";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    // Get basic stats
    const totalVisitors = await Thumbprint.countDocuments();
    const newVisitorsLast30Days = await Thumbprint.countDocuments({
      firstSeen: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    
    // Get device breakdown
    const deviceBreakdown = await Thumbprint.aggregate([
      {
        $group: {
          _id: "$device.type",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get daily visitors for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyVisits = await Thumbprint.aggregate([
      {
        $unwind: "$visits"
      },
      {
        $match: {
          "visits.timestamp": { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$visits.timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Get top pages
    const topPages = await Thumbprint.aggregate([
      {
        $unwind: "$visits"
      },
      {
        $group: {
          _id: "$visits.page",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Get order form step completion rates with time spent
    const orderSteps = await Thumbprint.aggregate([
      {
        $unwind: "$visits"
      },
      {
        $match: {
          "visits.page": { $regex: "^/order/" }
        }
      },
      {
        $group: {
          _id: "$visits.page",
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$fingerprintHash" },
          avgTimeSpent: { $avg: "$visits.timeSpentMs" },
          totalTimeSpent: { $sum: "$visits.timeSpentMs" }
        }
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueVisitors: { $size: "$uniqueVisitors" },
          avgTimeSpent: 1,
          totalTimeSpent: 1
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Get funnel completion metrics
    const funnelMetrics = await Thumbprint.aggregate([
      {
        $match: {
          "funnelData": { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          totalFunnels: { $sum: 1 },
          completedFunnels: {
            $sum: {
              $cond: [
                { $eq: ["$conversion.hasConverted", true] },
                1,
                0
              ]
            }
          },
          abandonedFunnels: {
            $sum: {
              $cond: [
                { $eq: ["$conversion.hasConverted", true] },
                0,
                1
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalFunnels: 1,
          completedFunnels: 1,
          abandonedFunnels: 1,
          conversionRate: {
            $multiply: [
              { $divide: ["$completedFunnels", { $max: ["$totalFunnels", 1] }] },
              100
            ]
          }
        }
      }
    ]);
    
    // Get step abandonment data
    const stepAbandonment = await Thumbprint.aggregate([
      {
        $match: {
          "funnelData.exitStep": { $exists: true },
          "conversion.hasConverted": { $ne: true }
        }
      },
      {
        $group: {
          _id: "$funnelData.exitStep",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get visits by day of week (1 = Sunday, 7 = Saturday in MongoDB)
    const visitsByDayOfWeek = await Thumbprint.aggregate([
      { $unwind: "$visits" },
      {
        $group: {
          _id: { $dayOfWeek: "$visits.timestamp" },
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$fingerprintHash" }
        }
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueVisitors: { $size: "$uniqueVisitors" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get visits by hour of day (0-23)
    const visitsByHourOfDay = await Thumbprint.aggregate([
      { $unwind: "$visits" },
      {
        $group: {
          _id: { $hour: "$visits.timestamp" },
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$fingerprintHash" }
        }
      },
      {
        $project: {
          _id: 1,
          count: 1,
          uniqueVisitors: { $size: "$uniqueVisitors" }
        }
      },
      { $sort: { _id: 1 } }
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
        conversionRate: 0
      },
      stepAbandonment,
      visitsByDayOfWeek,
      visitsByHourOfDay
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
