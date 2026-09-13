import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { Settings } from "@/models/settings";
import {
  settingsUpdateSchema,
  deliveryZonesPatchSchema,
  firstIssueMessage,
} from "@/lib/validation";
import { DEFAULT_TIER_MINIMUMS } from "@/lib/delivery/tierMinimums";
import { guardAdminWrite } from "@/lib/api-guard";
import { safeErrorSummary } from "@/lib/safe-error";

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

    // `flattenMaps`, for the same reason `getPublicSettings` needs it:
    // `deliveryZones.customFees` is a Mongoose `Map`, and `JSON.stringify`
    // renders a Map as `{}`. Without it the delivery-zone admin loads an empty
    // fee map and reports every ZIP as "not serviced" over a database where all
    // 120 are priced — then offers to "fix" it by re-pricing them. The public
    // read was fixed when it was written; this one was not, and it shipped.
    return NextResponse.json(settings.toObject({ flattenMaps: true }));
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

    // `deliveryZones` is written one dotted path at a time, never as a subtree.
    // `$set: { deliveryZones: {...} }` replaces the whole thing, so a body
    // carrying only `insideZips` would delete every ZIP's fee — and the fee map
    // is the service area, so that is the whole business, silently. This branch
    // exists for seeders and imports; the admin page uses PATCH below.
    if (data.deliveryZones) {
      for (const [key, value] of Object.entries(data.deliveryZones)) {
        update[`deliveryZones.${key}`] = value;
      }
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

    // `flattenMaps`, for the same reason GET and PATCH need it: without it
    // `deliveryZones.customFees` is a Mongoose Map and serialises as `{}`, so
    // this response would tell its caller that no ZIP is priced. Nothing reads
    // it today — the zone admin writes through PATCH — which is exactly how
    // the GET shipped without it (#14) and reported all 120 ZIPs unserviced.
    return NextResponse.json(updated.toObject({ flattenMaps: true }));
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

/**
 * The narrow delivery-zone write verbs.
 *
 * Separate from `PUT` because `customFees` is a wholesale assignment: an admin
 * page that priced one ZIP by resending the map had to rebuild every entry from
 * whatever the browser had loaded, so pricing one ZIP reverted every fee written
 * since that page load. Each verb here sends only its own slice and mutates the
 * stored document in place.
 *
 * `findOne` + `save()` rather than `findOneAndUpdate`, because a Map has to be
 * mutated through the hydrated document — and because `save()` is the one write
 * path where the schema's own validators actually run.
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const guard = await guardAdminWrite(request);
    if (!guard.ok) return guard.response;

    const parsed = deliveryZonesPatchSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const patch = parsed.data;

    await dbConnect();
    const settings =
      (await Settings.findOne({ key: "global" })) ??
      new Settings({ key: "global" });

    if ("setCustomZipFee" in patch) {
      const { zipCode, fee } = patch.setCustomZipFee;
      settings.deliveryZones.customFees.set(zipCode, fee);
      settings.markModified("deliveryZones.customFees");
    } else if ("removeCustomZipFee" in patch) {
      // Deletes the key. Writing 0 would say "we deliver here for free", which
      // is the opposite of what removing a fee means.
      settings.deliveryZones.customFees.delete(patch.removeCustomZipFee);
      settings.markModified("deliveryZones.customFees");
    } else if ("updateZipLists" in patch) {
      // Each list assigned independently: a body naming one must not clear the
      // other. An emptied list is a state the admin is entitled to save —
      // membership is geography and grants no price, so an empty zone is
      // survivable in a way an empty fee map is not.
      const { insideZips, outsideZips } = patch.updateZipLists;
      if (insideZips) settings.deliveryZones.insideZips = insideZips;
      if (outsideZips) settings.deliveryZones.outsideZips = outsideZips;
    } else if ("updateTierMinimums" in patch) {
      // Merged, not replaced: the legend saves the band the admin touched and
      // omits the rest, and an omitted band must keep its stored figure.
      settings.deliveryZones.tierMinimums = {
        ...DEFAULT_TIER_MINIMUMS,
        ...(settings.deliveryZones.tierMinimums ?? {}),
        ...patch.updateTierMinimums,
      };
    } else {
      // One scalar, so there is nothing to merge. Zero is a legal value — an
      // admin who wants distance to be the only charge is entitled to say so —
      // and is stored, not treated as "unset" and re-defaulted on the next read.
      settings.deliveryZones.baseFee = patch.updateBaseFee;
    }

    settings.updatedAt = new Date();
    settings.updatedBy = session.user?.name ?? "admin";
    await settings.save();

    return NextResponse.json(settings.toObject({ flattenMaps: true }));
  } catch (error) {
    console.error("Error updating delivery zones:", safeErrorSummary(error));

    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Invalid delivery zone data" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to update delivery zones" },
      { status: 500 },
    );
  }
}
