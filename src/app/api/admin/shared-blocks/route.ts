import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { SharedBlock, MODEL_RULE_MESSAGES } from "@/models/sharedBlock";
import { guardAdminWrite } from "@/lib/api-guard";
import { adminListHeaders, adminListLimit } from "@/lib/admin-list";
import { sharedBlockCreateSchema, firstIssueMessage } from "@/lib/validation";
import { LANDING_BODY_LIMIT } from "@/lib/landing";
import { safeErrorSummary } from "@/lib/safe-error";

// GET /api/admin/shared-blocks - every block, draft and published alike
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

    // `sections` is kept here, unlike the landing-page list: the section
    // editor populates its "insert a shared block" picker from this response
    // and needs enough to show what a block contains.
    const [blocks, total] = await Promise.all([
      SharedBlock.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("-__v")
        .lean(),
      SharedBlock.countDocuments({}),
    ]);

    return NextResponse.json(blocks, {
      headers: adminListHeaders(total, blocks.length),
    });
  } catch (error) {
    console.error("Error fetching shared blocks:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to fetch shared blocks" },
      { status: 500 },
    );
  }
}

// POST /api/admin/shared-blocks - create a block
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const guard = await guardAdminWrite(request, LANDING_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = sharedBlockCreateSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    const { slug, name, sections, status } = parsed.data;

    await dbConnect();

    const block = new SharedBlock({
      slug,
      name,
      sections,
      status: status ?? "draft",
    });

    await block.save();

    return NextResponse.json(block, { status: 201 });
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

    console.error("Error creating shared block:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to create shared block" },
      { status: 500 },
    );
  }
}
