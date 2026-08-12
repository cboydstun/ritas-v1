import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LeaseInquiry } from "@/models/leaseInquiry";
import { adminListLimit, adminListHeaders } from "@/lib/admin-list";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const limit = adminListLimit(
      new URL(request.url).searchParams.get("limit"),
    );
    const [inquiries, total] = await Promise.all([
      LeaseInquiry.find({})
        .sort({ createdAt: -1 }) // Sort by newest first
        .limit(limit)
        .select("-__v") // Exclude version key
        .lean(),
      LeaseInquiry.countDocuments({}),
    ]);

    return NextResponse.json(inquiries, {
      headers: adminListHeaders(total, inquiries.length),
    });
  } catch (error) {
    console.error("Error fetching lease inquiries:", error);
    return NextResponse.json(
      { message: "Failed to fetch lease inquiries" },
      { status: 500 },
    );
  }
}
