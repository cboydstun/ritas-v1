import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Settings } from "@/models/settings";

/** The only settings an admin may write through this route. */
const EDITABLE_SETTINGS_FIELDS = [
  "fees",
  "machines",
  "mixers",
  "extras",
  "leaseTiers",
  "operations",
  "documentation",
] as const;

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

    // Explicit whitelist rather than `{ ...body }`. Spreading the body was
    // the last mass-assignment site in the codebase: `mixers`, `extras` and
    // `leaseTiers` are Mixed paths that Mongoose does not deep-validate, and a
    // body key beginning with `$` reached Mongo as an update operator instead
    // of a field.
    const update: Record<string, unknown> = {
      key: "global",
      updatedAt: new Date(),
      // `authorize` returns only { id, name, role } — no email ever reaches
      // the JWT, so `session.user.email` was always undefined and the audit
      // field recorded nothing.
      updatedBy: session.user?.name ?? "admin",
    };
    for (const field of EDITABLE_SETTINGS_FIELDS) {
      // The Mixed maps are reassigned wholesale on purpose — Mongoose does not
      // dirty-track inside them, so a partial merge would not persist.
      if (body?.[field] !== undefined) update[field] = body[field];
    }

    const updated = await Settings.findOneAndUpdate({ key: "global" }, update, {
      upsert: true,
      new: true,
      runValidators: true,
    });

    return NextResponse.json(updated.toObject());
  } catch (error) {
    console.error("Error updating settings:", error);

    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Invalid settings data" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to update settings" },
      { status: 500 },
    );
  }
}
