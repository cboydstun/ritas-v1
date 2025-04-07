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
    
    // Get order form step completion rates
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
      {
        $sort: { _id: 1 }
      }
    ]);
    
    return NextResponse.json({
      totalVisitors,
      newVisitorsLast30Days,
      deviceBreakdown,
      dailyVisits,
      topPages,
      orderSteps
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
