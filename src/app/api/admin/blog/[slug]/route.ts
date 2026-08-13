import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { BlogPost, MODEL_RULE_MESSAGES } from "@/models/blogPost";
import { guardAdminWrite } from "@/lib/api-guard";
import { blogPostUpdateSchema, firstIssueMessage } from "@/lib/validation";
import { SLUG_PATTERN } from "@/lib/blog";
import { safeErrorSummary } from "@/lib/safe-error";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const BLOG_BODY_LIMIT = 256 * 1024;

/** Fields the admin may clear by sending an empty string. */
const CLEARABLE = [
  "excerpt",
  "coverImagePath",
  "coverImageAlt",
  "seoTitle",
  "seoDescription",
  "focusKeyword",
] as const;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// GET /api/admin/blog/[slug] - one post, any status
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { slug } = await context.params;
    // The resource is keyed by slug, so there is no ObjectId to validate. A
    // malformed slug cannot match anything, and answering 404 keeps this
    // handler from leaking whether the collection was even queried.
    if (!SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    await dbConnect();

    const post = await BlogPost.findOne({ slug }).select("-__v").lean();
    if (!post) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error fetching blog post:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to fetch blog post" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/blog/[slug] - edit, rename, publish or unpublish
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { slug } = await context.params;
    if (!SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    const guard = await guardAdminWrite(request, BLOG_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = blogPostUpdateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const data = parsed.data;

    await dbConnect();

    const existing = await BlogPost.findOne({ slug });
    if (!existing) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    // Built field by field from the parsed data. Spreading the body here is
    // what let `_id` and `createdAt` be written on the routes this one is
    // modelled on; mongoose also skips `undefined`, so clearing an optional
    // field needs `$unset` rather than `$set: undefined`.
    const set: Record<string, unknown> = { updatedAt: new Date() };
    const unset: Record<string, unknown> = {};

    if (data.slug !== undefined) set.slug = data.slug;
    if (data.title !== undefined) set.title = data.title;
    if (data.body !== undefined) set.body = data.body;
    if (data.tags !== undefined) set.tags = data.tags;
    if (data.status !== undefined) set.status = data.status;

    for (const field of CLEARABLE) {
      const value = data[field];
      if (value === undefined) continue;
      if (value === "") unset[field] = "";
      else set[field] = value;
    }

    // First publish stamps the date; a later edit must not re-stamp it. This
    // is the same discipline that keeps `PUT /api/admin/orders/[id]` from
    // repricing a months-old order — a published post's date is a fact about
    // when it went live, not about when it was last touched.
    if (data.status === "published" && !existing.publishedAt) {
      set.publishedAt = new Date();
    }

    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const updated = await BlogPost.findOneAndUpdate({ slug }, update, {
      new: true,
      runValidators: true,
    })
      .select("-__v")
      .lean();

    // Null here means the post was deleted between the read and the write.
    if (!updated) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    // A rename onto a slug that is already taken. The client needs to know
    // this specifically, because the fix is to pick a different slug.
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { message: "A post with that slug already exists" },
        { status: 409 },
      );
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { message: "Invalid blog post data" },
        { status: 400 },
      );
    }

    if (error instanceof Error && MODEL_RULE_MESSAGES.has(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error updating blog post:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to update blog post" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/blog/[slug]
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const { slug } = await context.params;
    if (!SLUG_PATTERN.test(slug)) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    await dbConnect();

    const deleted = await BlogPost.findOneAndDelete({ slug });
    if (!deleted) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Post deleted" });
  } catch (error) {
    console.error("Error deleting blog post:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to delete blog post" },
      { status: 500 },
    );
  }
}
