import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Settings } from "@/models/settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    let settings = await Settings.findOne({ key: "global" });

    if (!settings) {
      // Return schema defaults without persisting
      settings = new Settings({});
    }

    return NextResponse.json(settings.toObject());
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { message: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    await dbConnect();

    const updated = await Settings.findOneAndUpdate(
      { key: "global" },
      {
        ...body,
        key: "global",
        updatedAt: new Date(),
        updatedBy: session.user.email,
      },
      { upsert: true, new: true, runValidators: true },
    );

    return NextResponse.json(updated.toObject());
  } catch (error) {
    console.error("Error updating settings:", error);

    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Invalid settings data", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to update settings" },
      { status: 500 },
    );
  }
}
