import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { BlogPost } from "@/models/blogPost";
import { guardAdminWrite } from "@/lib/api-guard";
import { firstIssueMessage } from "@/lib/validation";
import { MAX_BODY_LENGTH } from "@/lib/blog";
import { similarity } from "@/lib/seo-audit";
import { safeErrorSummary } from "@/lib/safe-error";

/**
 * The one audit check that cannot run in the editor: it needs every other
 * post's body. Everything else in `src/lib/seo-audit.ts` is a pure function of
 * the draft in front of the author and runs client-side.
 *
 * Deliberately a POST rather than a GET, because the body being compared is
 * unsaved draft content and can be tens of kilobytes — too big for a query
 * string, and not something to put in a URL that ends up in logs.
 *
 * It sits at `/api/admin/blog-audit` rather than `/api/admin/blog/audit`
 * because a static segment outranks a dynamic one in Next's matcher: nesting
 * it under `blog/` would shadow `/api/admin/blog/[slug]` for a post whose slug
 * happened to be "audit", locking that one post out of every edit.
 */
const BLOG_BODY_LIMIT = 256 * 1024;

const auditRequestSchema = z
  .object({
    // The post being audited, so it is not compared against itself. Absent for
    // a post that has not been saved yet.
    slug: z.string().trim().max(200).optional(),
    body: z.string().max(MAX_BODY_LENGTH),
  })
  .strip();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const guard = await guardAdminWrite(request, BLOG_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = auditRequestSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { slug, body } = parsed.data;

    await dbConnect();

    // Drafts count. Two drafts converging on the same topic is exactly the
    // problem worth catching, and catching it before either is published is
    // the whole point.
    const others = await BlogPost.find(slug ? { slug: { $ne: slug } } : {})
      .select("slug body")
      .lean();

    let closest: { slug: string; similarity: number } | null = null;
    for (const other of others as Array<{ slug: string; body?: string }>) {
      const score = similarity(body, other.body ?? "");
      if (!closest || score > closest.similarity) {
        closest = { slug: other.slug, similarity: score };
      }
    }

    return NextResponse.json({ duplicate: closest });
  } catch (error) {
    console.error("Error auditing blog post:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to audit blog post" },
      { status: 500 },
    );
  }
}
