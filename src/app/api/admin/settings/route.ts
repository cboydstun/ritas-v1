import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Settings } from "@/models/settings";
import { settingsUpdateSchema, firstIssueMessage } from "@/lib/validation";
import { guardAdminWrite } from "@/lib/api-guard";

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
    // Admin handlers read the body directly, so MAX_BODY_BYTES never
    // applied to them. Post-auth this bounds a compromised session.
    const guard = await guardAdminWrite(request);
    if (!guard.ok) return guard.response;
    const body = guard.data as Record<string, unknown>;

    // `findOneAndUpdate` + `runValidators` runs path validators only, so the
    // model's `pre("validate")` delivery-window rule never fired here and the
    // three Mixed maps were never checked at all. An inverted window made
    // `validateDeliveryTime` reject every time on the order form; a
    // non-numeric mixer price produced a `NaN` order total.
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const data = parsed.data;

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
      if (data[field] !== undefined) update[field] = data[field];
    }

    // A body that moves only one end of the delivery window is still able to
    // invert it against the value already stored, which the schema cannot see.
    const ops = data.operations;
    if (
      ops &&
      (ops.deliveryWindowStartHour === undefined) !==
        (ops.deliveryWindowEndHour === undefined)
    ) {
      const current = (await Settings.findOne({ key: "global" })
        .select("operations")
        .lean()) as {
        operations?: {
          deliveryWindowStartHour?: number;
          deliveryWindowEndHour?: number;
        };
      } | null;
      const start =
        ops.deliveryWindowStartHour ??
        current?.operations?.deliveryWindowStartHour ??
        8;
      const end =
        ops.deliveryWindowEndHour ??
        current?.operations?.deliveryWindowEndHour ??
        18;
      if (start >= end) {
        return NextResponse.json(
          {
            message:
              "operations.deliveryWindowEndHour: deliveryWindowEndHour must be greater than deliveryWindowStartHour",
          },
          { status: 400 },
        );
      }
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
