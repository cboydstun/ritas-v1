import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { BlogPost, MODEL_RULE_MESSAGES } from "@/models/blogPost";
import { guardAdminWrite } from "@/lib/api-guard";
import { adminListHeaders, adminListLimit } from "@/lib/admin-list";
import { blogPostCreateSchema, firstIssueMessage } from "@/lib/validation";
import { safeErrorSummary } from "@/lib/safe-error";

/**
 * Post bodies are HTML and legitimately run to tens of kilobytes, so the
 * default 64 KB cap in `guardAdminWrite` is too tight to author against. The
 * model bounds `body` at 100 000 characters; this leaves room for that plus
 * the rest of the document.
 */
const BLOG_BODY_LIMIT = 256 * 1024;

// GET /api/admin/blog - list every post, draft and published alike
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

    const [posts, total] = await Promise.all([
      BlogPost.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("-__v -body")
        .lean(),
      BlogPost.countDocuments({}),
    ]);

    return NextResponse.json(posts, {
      headers: adminListHeaders(total, posts.length),
    });
  } catch (error) {
    console.error("Error fetching blog posts:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to fetch blog posts" },
      { status: 500 },
    );
  }
}

// POST /api/admin/blog - create a post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const guard = await guardAdminWrite(request, BLOG_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = blogPostCreateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    const {
      slug,
      title,
      excerpt,
      body,
      coverImagePath,
      coverImageAlt,
      tags,
      status,
      seoTitle,
      seoDescription,
      focusKeyword,
    } = parsed.data;

    await dbConnect();

    // Fields are named one by one rather than spread, so a body carrying
    // `_id`, `createdAt` or `author` cannot write them.
    const post = new BlogPost({
      slug,
      title,
      excerpt,
      body,
      coverImagePath,
      coverImageAlt,
      tags: tags ?? [],
      status: status ?? "draft",
      // A post created straight into `published` needs its stamp here — the
      // model hook rejects a published document without one.
      publishedAt: status === "published" ? new Date() : undefined,
      author: session.user?.name || "SATX Ritas",
      seoTitle,
      seoDescription,
      focusKeyword,
    });

    await post.save();

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    // 11000 is a duplicate key, and the only unique index on this collection
    // is `slug`. A taken slug is the caller's problem to fix, not a 500.
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

    // The model's `pre("save")` hooks throw plain Errors, so they need
    // recognising by message rather than by type.
    if (error instanceof Error && MODEL_RULE_MESSAGES.has(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error creating blog post:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to create blog post" },
      { status: 500 },
    );
  }
}
