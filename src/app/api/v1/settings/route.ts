import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Settings } from "@/models/settings";

export async function GET() {
  try {
    await dbConnect();
    let settings = await Settings.findOne({ key: "global" });

    if (!settings) {
      settings = new Settings({});
    }

    const doc = settings.toObject();

    // Return only public-safe fields
    return NextResponse.json({
      fees: doc.fees,
      machines: doc.machines,
      mixers: doc.mixers,
      extras: doc.extras,
      operations: doc.operations,
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return NextResponse.json(
      { message: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}
