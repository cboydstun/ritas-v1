import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { safeErrorSummary } from "@/lib/safe-error";

/**
 * Dashboard totals, computed in Mongo.
 *
 * The dashboard used to fetch /api/admin/orders and reduce it in the browser.
 * That route is capped at ADMIN_LIST_MAX (500) and reports the truncation in
 * `X-Result-Truncated`, which the page ignored — so once the collection passed
 * 500 documents the Total Orders and Total Revenue tiles were simply wrong,
 * with nothing on screen to say so. A $group also removes a multi-hundred-
 * document payload from the wire.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();

    const [totals] = await Rental.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$payment.status", "completed"] },
                { $ifNull: ["$payment.amount", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    return NextResponse.json({
      totalOrders: totals?.totalOrders ?? 0,
      pendingOrders: totals?.pendingOrders ?? 0,
      completedOrders: totals?.completedOrders ?? 0,
      totalRevenue: totals?.totalRevenue ?? 0,
    });
  } catch (error) {
    console.error("Error computing admin stats:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to compute stats" },
      { status: 500 },
    );
  }
}
