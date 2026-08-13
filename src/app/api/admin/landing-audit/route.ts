import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { LandingPage } from "@/models/landingPage";
import { SharedBlock } from "@/models/sharedBlock";
import { guardAdminWrite } from "@/lib/api-guard";
import { firstIssueMessage } from "@/lib/validation";
import {
  LANDING_BODY_LIMIT,
  MAX_DESCRIPTION_LENGTH,
  MAX_PATH_LENGTH,
  MAX_TITLE_LENGTH,
  type LandingSection,
} from "@/lib/landing";
import {
  sectionsToHtml,
  type LandingCrossPageFacts,
} from "@/lib/landing-audit";
import { similarity } from "@/lib/seo-audit";
import { safeErrorSummary } from "@/lib/safe-error";

/**
 * The audit checks that cannot run in the editor, because they need the other
 * documents: near-duplicate content, a title or description another page has
 * already claimed, whether an internal link resolves to anything, and whether
 * a `blockRef` points at a block that is actually published. Everything else
 * in `src/lib/landing-audit.ts` is a pure function of the draft in front of
 * the admin and runs client-side.
 *
 * POST rather than GET: the text being compared is unsaved draft content and
 * can be tens of kilobytes — too big for a query string, and not something to
 * put in a URL that ends up in logs.
 *
 * **It sits at `/api/admin/landing-audit`, not `/api/admin/landing-pages/audit`.**
 * A static segment outranks a dynamic one in Next's matcher, so an `audit/`
 * child would shadow the `[...path]` catch-all next door and lock a landing
 * page at `/audit` out of every edit. `blog-audit/route.ts` documents the same
 * hazard; it is worse here, because the sibling is a catch-all rather than a
 * single dynamic segment.
 *
 * The route returns raw facts. Every threshold — what counts as too similar,
 * what a collision means — stays in `landing-audit.ts`, so the editor and any
 * future caller interpret them identically.
 */
const MAX_TEXT_LENGTH = 100_000;

const auditRequestSchema = z
  .object({
    // The page being audited, so it is not compared against itself. Absent for
    // a page that has not been saved yet.
    path: z.string().trim().max(MAX_PATH_LENGTH).optional(),
    text: z.string().max(MAX_TEXT_LENGTH),
    seoTitle: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
    seoDescription: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
  })
  .strip();

interface StoredPage {
  path: string;
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  sections?: LandingSection[];
}

/** Case- and whitespace-insensitive, because that is how a duplicate reads. */
function normalise(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const guard = await guardAdminWrite(request, LANDING_BODY_LIMIT);
    if (!guard.ok) return guard.response;

    const parsed = auditRequestSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { path, text, seoTitle, seoDescription } = parsed.data;

    await dbConnect();

    // Drafts are included for the duplicate and collision comparisons — two
    // drafts converging on the same page is exactly the problem worth catching,
    // and catching it before either is published is the whole point.
    const others = (await LandingPage.find(path ? { path: { $ne: path } } : {})
      .select("path title seoTitle seoDescription status sections")
      .lean()) as unknown as StoredPage[];

    // Published only. A draft block resolves to nothing on the live page, which
    // is the failure this reports rather than a state it should tolerate.
    const blocks = (await SharedBlock.find({ status: "published" })
      .select("slug")
      .lean()) as unknown as Array<{ slug: string }>;

    const wantedTitle = normalise(seoTitle);
    const wantedDescription = normalise(seoDescription);

    let duplicate: LandingCrossPageFacts["duplicate"] = null;
    let titleCollision: string | null = null;
    let descriptionCollision: string | null = null;
    const publishedPaths: string[] = [];

    for (const other of others) {
      const score = similarity(text, sectionsToHtml(other.sections ?? []));
      if (!duplicate || score > duplicate.similarity) {
        duplicate = { path: other.path, similarity: score };
      }

      // The tag renders `seoTitle || title`, so that is what can collide.
      const otherTitle = normalise(other.seoTitle || other.title);
      if (!titleCollision && wantedTitle !== "" && otherTitle === wantedTitle) {
        titleCollision = other.path;
      }
      const otherDescription = normalise(other.seoDescription);
      if (
        !descriptionCollision &&
        wantedDescription !== "" &&
        otherDescription === wantedDescription
      ) {
        descriptionCollision = other.path;
      }

      if (other.status === "published") publishedPaths.push(other.path);
    }

    const facts: LandingCrossPageFacts = {
      duplicate,
      titleCollision,
      descriptionCollision,
      publishedPaths,
      publishedBlockSlugs: blocks.map((block) => block.slug),
    };

    return NextResponse.json(facts);
  } catch (error) {
    console.error("Error auditing landing page:", safeErrorSummary(error));
    return NextResponse.json(
      { message: "Failed to audit landing page" },
      { status: 500 },
    );
  }
}
