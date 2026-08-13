import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LandingPage, MODEL_RULE_MESSAGES } from "@/models/landingPage";
import { guardAdminWrite } from "@/lib/api-guard";
import { adminListHeaders, adminListLimit } from "@/lib/admin-list";
import { landingPageCreateSchema, firstIssueMessage } from "@/lib/validation";
import { safeErrorSummary } from "@/lib/safe-error";
import { revalidateLandingPath } from "@/lib/landing-revalidate";
import { LANDING_BODY_LIMIT } from "@/lib/landing";

// GET /api/admin/landing-pages - every page, draft and published alike
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const limit = adminListLimit(
      new URL(request.url).searchParams.get("limit"),
    );

    // `sections` is dropped so the table response stays small. The editor
    // re-fetches the single page, exactly as /admin/blog re-fetches for
    // `body` — opening the form on a projection that lacks the sections would
    // save an empty page over a full one.
    const [pages, total] = await Promise.all([
      LandingPage.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("-__v -sections")
        .lean(),
      LandingPage.countDocuments({}),
    ]);

    return NextResponse.json(pages, {
      headers: adminListHeaders(total, pages.length),
    });
  } catch (error) {
    console.error("Error fetching landing pages:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to fetch landing pages" },
      { status: 500 },
    );
  }
}

// POST /api/admin/landing-pages - create a page
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const guard = await guardAdminWrite(request, LANDING_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = landingPageCreateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    const {
      path,
      title,
      seoTitle,
      seoDescription,
      ogImagePath,
      breadcrumbs,
      sections,
      schemaType,
      serviceAreaName,
      status,
    } = parsed.data;

    await dbConnect();

    // Fields are named one by one rather than spread, so a body carrying
    // `_id`, `createdAt` or `updatedAt` cannot write them.
    const page = new LandingPage({
      path,
      title,
      seoTitle,
      seoDescription,
      ogImagePath: ogImagePath || undefined,
      breadcrumbs: breadcrumbs ?? [],
      sections,
      schemaType: schemaType ?? "WebPage",
      serviceAreaName,
      status: status ?? "draft",
      // A page created straight into `published` needs its stamp here — the
      // model hook rejects a published document without one.
      publishedAt: status === "published" ? new Date() : undefined,
    });

    await page.save();
    await revalidateLandingPath(page.path);

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    // 11000 is a duplicate key, and the only unique index on this collection
    // is `path`. A taken path is the caller's problem to fix, not a 500.
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

    // The model's `pre("save")` hooks throw plain Errors, so they need
    // recognising by message rather than by type.
    if (error instanceof Error && MODEL_RULE_MESSAGES.has(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error creating landing page:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to create landing page" },
      { status: 500 },
    );
  }
}
