import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LandingPage } from "@/models/landingPage";
import { landingPageCreateSchema, firstIssueMessage } from "@/lib/validation";
import { SERVICE_AREA_SEED } from "@/lib/service-area-page";
import { safeErrorSummary } from "@/lib/safe-error";
import { revalidateLandingPath } from "@/lib/landing-revalidate";

/**
 * POST /api/admin/service-area-seed — write the 16 service-area pages.
 *
 * A route rather than a script because this repo has no `scripts/` directory
 * and no build tooling for one: running inside the deployed app means the same
 * `dbConnect`, the same models and the same zod schemas, no new dependency, no
 * local database access, and — unlike a standalone script — it is exercised by
 * the existing route-test harness.
 *
 * It lives in its own namespace deliberately. As a `landing-pages/seed/` child
 * it would win route precedence over the `[...path]` catch-all and make a
 * landing page at `/seed` permanently unreachable through the admin API.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // The seed is not exempt from validation. `sections` is a Mixed path, so
    // zod is the only thing that checks it — a seed that wrote around the
    // schema could store a shape no route would ever accept.
    const operations = [];
    for (const doc of SERVICE_AREA_SEED) {
      const parsed = landingPageCreateSchema.safeParse(doc);
      if (!parsed.success) {
        console.error(
          `Seed document for ${doc.path} is invalid:`,
          firstIssueMessage(parsed.error),
        );
        return NextResponse.json(
          { message: `Seed data for ${doc.path} is invalid` },
          { status: 500 },
        );
      }

      const {
        path,
        title,
        seoTitle,
        seoDescription,
        breadcrumbs,
        sections,
        schemaType,
        serviceAreaName,
      } = parsed.data;

      operations.push({
        updateOne: {
          filter: { path },
          // `$setOnInsert`, never `$set`: re-running the seed can then never
          // overwrite an admin's edits. That is what makes the button safe to
          // press twice, safe after a partial failure, and safe after a 17th
          // area is added. To reset one page, delete it and seed again.
          update: {
            $setOnInsert: {
              path,
              title,
              seoTitle,
              seoDescription,
              breadcrumbs,
              sections,
              schemaType,
              serviceAreaName,
              status: "published",
              publishedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    await dbConnect();

    const existing = await LandingPage.find({
      path: { $in: SERVICE_AREA_SEED.map((doc) => doc.path) },
    })
      .select("path")
      .lean();
    const skipped = (existing as { path: string }[]).map((doc) => doc.path);
    const created = SERVICE_AREA_SEED.map((doc) => doc.path).filter(
      (path) => !skipped.includes(path),
    );

    await LandingPage.bulkWrite(operations);
    await revalidateLandingPath(...created);

    return NextResponse.json({ created, skipped });
  } catch (error) {
    console.error("Error seeding service-area pages:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to seed service-area pages" },
      { status: 500 },
    );
  }
}
