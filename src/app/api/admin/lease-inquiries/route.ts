import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LeaseInquiry } from "@/models/leaseInquiry";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const inquiries = await LeaseInquiry.find({})
      .sort({ createdAt: -1 })
      .select("-__v");

    return NextResponse.json(inquiries);
  } catch (error) {
    console.error("Error fetching lease inquiries:", error);
    return NextResponse.json(
      { message: "Failed to fetch lease inquiries" },
      { status: 500 },
    );
  }
}
