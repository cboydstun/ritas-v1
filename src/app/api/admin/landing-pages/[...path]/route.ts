import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LandingPage, MODEL_RULE_MESSAGES } from "@/models/landingPage";
import { guardAdminWrite } from "@/lib/api-guard";
import { landingPageUpdateSchema, firstIssueMessage } from "@/lib/validation";
import { LANDING_BODY_LIMIT, landingPathFromSegments } from "@/lib/landing";
import { safeErrorSummary } from "@/lib/safe-error";
import { revalidateLandingPath } from "@/lib/landing-revalidate";

/**
 * Keyed by the page's own path, so the client fetch URL is literally
 * `"/api/admin/landing-pages" + page.path`. A catch-all rather than a `[path]`
 * segment because the key contains slashes.
 *
 * Nothing static may be added as a sibling of this directory: a `seed/` child
 * would win precedence over the segments `["seed"]` and make a landing page at
 * `/seed` permanently unreachable through this API. The seeder lives at
 * `/api/admin/service-area-seed` for exactly that reason.
 */
interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/** Optional fields the admin may clear by sending an empty string. */
const CLEARABLE = [
  "seoTitle",
  "seoDescription",
  "ogImagePath",
  "serviceAreaName",
] as const;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const notFound = () =>
  NextResponse.json({ message: "Landing page not found" }, { status: 404 });

// GET /api/admin/landing-pages/<path> - one page, any status
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    // A malformed path cannot match anything stored, so this answers 404
    // before touching the database rather than leaking that it was queried.
    const path = landingPathFromSegments((await context.params).path);
    if (!path) return notFound();

    await dbConnect();

    const page = await LandingPage.findOne({ path }).select("-__v").lean();
    if (!page) return notFound();

    return NextResponse.json(page);
  } catch (error) {
    console.error("Error fetching landing page:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to fetch landing page" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/landing-pages/<path> - edit, move, publish or unpublish
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const path = landingPathFromSegments((await context.params).path);
    if (!path) return notFound();

    const guard = await guardAdminWrite(request, LANDING_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = landingPageUpdateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const data = parsed.data;

    await dbConnect();

    const existing = await LandingPage.findOne({ path });
    if (!existing) return notFound();

    // Built field by field from the parsed data. Spreading the body is what
    // let `_id` and `createdAt` be written on the routes this one is modelled
    // on; mongoose also skips `undefined`, so clearing an optional field needs
    // `$unset` rather than `$set: undefined`.
    const set: Record<string, unknown> = { updatedAt: new Date() };
    const unset: Record<string, unknown> = {};

    if (data.path !== undefined) set.path = data.path;
    if (data.title !== undefined) set.title = data.title;
    if (data.breadcrumbs !== undefined) set.breadcrumbs = data.breadcrumbs;
    if (data.schemaType !== undefined) set.schemaType = data.schemaType;
    if (data.status !== undefined) set.status = data.status;
    // The whole array, never a positional update. `sections` is Mixed, so
    // mongoose does not dirty-track it — a replacing `$set` sidesteps that
    // entirely and keeps one write shape to validate and test.
    if (data.sections !== undefined) set.sections = data.sections;

    for (const field of CLEARABLE) {
      const value = data[field];
      if (value === undefined) continue;
      if (value === "") unset[field] = "";
      else set[field] = value;
    }

    // First publish stamps the date; a later edit must not re-stamp it. Same
    // discipline that keeps `PUT /api/admin/orders/[id]` from repricing a
    // months-old order — the date is a fact about when the page went live.
    if (data.status === "published" && !existing.publishedAt) {
      set.publishedAt = new Date();
    }

    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const updated = await LandingPage.findOneAndUpdate({ path }, update, {
      new: true,
      runValidators: true,
    })
      .select("-__v")
      .lean();

    // Null here means the page was deleted between the read and the write.
    if (!updated) return notFound();

    // Both paths on a move: the new one so it appears, the old one so it stops
    // serving a page that no longer lives there.
    await revalidateLandingPath(path, (updated as { path: string }).path);

    return NextResponse.json(updated);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { message: "A landing page with that path already exists" },
        { status: 409 },
      );
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { message: Object.values(error.errors)[0]?.message ?? "Invalid data" },
        { status: 400 },
      );
    }

    if (error instanceof Error && MODEL_RULE_MESSAGES.has(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error updating landing page:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to update landing page" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/landing-pages/<path>
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const path = landingPathFromSegments((await context.params).path);
    if (!path) return notFound();

    await dbConnect();

    const deleted = await LandingPage.findOneAndDelete({ path });
    if (!deleted) return notFound();

    await revalidateLandingPath(path);

    return NextResponse.json({ message: "Landing page deleted" });
  } catch (error) {
    console.error("Error deleting landing page:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to delete landing page" },
      { status: 500 },
    );
  }
}
