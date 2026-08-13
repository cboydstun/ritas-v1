import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { SharedBlock, MODEL_RULE_MESSAGES } from "@/models/sharedBlock";
import { LandingPage } from "@/models/landingPage";
import { guardAdminWrite } from "@/lib/api-guard";
import { sharedBlockUpdateSchema, firstIssueMessage } from "@/lib/validation";
import { LANDING_BODY_LIMIT } from "@/lib/landing";
import { SLUG_PATTERN } from "@/lib/blog";
import { safeErrorSummary } from "@/lib/safe-error";
import { revalidateLandingPath } from "@/lib/landing-revalidate";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const notFound = () =>
  NextResponse.json({ message: "Shared block not found" }, { status: 404 });

/**
 * The paths of every landing page that inserts this block.
 *
 * Backed by the `sections.blockSlug` multikey index on `landingPage.ts` —
 * legal against a Mixed array, because Mixed removes mongoose's casting, not
 * Mongo's indexing.
 */
async function referencingPaths(slug: string): Promise<string[]> {
  const pages = await LandingPage.find({ "sections.blockSlug": slug })
    .select("path")
    .lean();
  return (pages as { path: string }[]).map((page) => page.path);
}

// GET /api/admin/shared-blocks/[slug]
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { slug } = await context.params;
    if (!SLUG_PATTERN.test(slug)) return notFound();

    await dbConnect();

    const block = await SharedBlock.findOne({ slug }).select("-__v").lean();
    if (!block) return notFound();

    return NextResponse.json(block);
  } catch (error) {
    console.error("Error fetching shared block:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to fetch shared block" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/shared-blocks/[slug]
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { slug } = await context.params;
    if (!SLUG_PATTERN.test(slug)) return notFound();

    const guard = await guardAdminWrite(request, LANDING_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = sharedBlockUpdateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const data = parsed.data;

    await dbConnect();

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.slug !== undefined) set.slug = data.slug;
    if (data.name !== undefined) set.name = data.name;
    if (data.sections !== undefined) set.sections = data.sections;
    if (data.status !== undefined) set.status = data.status;

    // Read the references before the write: a slug rename changes which pages
    // match, and the pages holding the *old* slug are the ones whose rendered
    // output just changed.
    const affected = await referencingPaths(slug);

    const updated = await SharedBlock.findOneAndUpdate(
      { slug },
      { $set: set },
      { new: true, runValidators: true },
    )
      .select("-__v")
      .lean();

    if (!updated) return notFound();

    // Editing one block changes every page that inserts it, and each of those
    // is a separately cached ISR entry.
    await revalidateLandingPath(...affected);

    return NextResponse.json(updated);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { message: "A shared block with that slug already exists" },
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

    console.error("Error updating shared block:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to update shared block" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/shared-blocks/[slug]
 *
 * Refuses with 409 while any landing page still inserts the block, naming the
 * pages so the admin can go and unpick them. `?force=1` deletes anyway — the
 * renderer drops an unresolvable ref silently, so nothing breaks, but that
 * failsafe should not be the first thing an admin discovers.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { slug } = await context.params;
    if (!SLUG_PATTERN.test(slug)) return notFound();

    await dbConnect();

    const force = new URL(request.url).searchParams.get("force") === "1";
    const affected = await referencingPaths(slug);

    if (affected.length > 0 && !force) {
      return NextResponse.json(
        {
          message: `Still used by ${affected.length} page${
            affected.length === 1 ? "" : "s"
          }: ${affected.join(", ")}`,
          paths: affected,
        },
        { status: 409 },
      );
    }

    const deleted = await SharedBlock.findOneAndDelete({ slug });
    if (!deleted) return notFound();

    await revalidateLandingPath(...affected);

    return NextResponse.json({ message: "Shared block deleted" });
  } catch (error) {
    console.error("Error deleting shared block:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to delete shared block" },
      { status: 500 },
    );
  }
}
