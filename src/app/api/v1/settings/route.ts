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

    // `machines` carries per-type `inventory` alongside `basePrice`; only the
    // price is any of the browser's business.
    const machines = Object.fromEntries(
      Object.entries(doc.machines ?? {}).map(([type, config]) => [
        type,
        { basePrice: (config as { basePrice?: number })?.basePrice },
      ]),
    );

    // Return only public-safe fields
    return NextResponse.json({
      fees: doc.fees,
      machines,
      mixers: doc.mixers,
      extras: doc.extras,
      operations: doc.operations,
      leaseTiers: doc.leaseTiers,
      documentation: doc.documentation,
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return NextResponse.json(
      { message: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}
