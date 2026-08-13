import dbConnect from "@/lib/mongodb";
import { LandingPage } from "@/models/landingPage";
import { SharedBlock } from "@/models/sharedBlock";
import { safeErrorSummary } from "@/lib/safe-error";
import { blockSlugsIn } from "@/lib/landing";
import { serviceAreaFallbackPage } from "@/lib/service-area-page";
import type {
  ContentSection,
  LandingPageRecord,
  LandingSection,
  SharedBlockRecord,
} from "@/lib/landing";

/**
 * The public read side of the landing pages.
 *
 * Server components call these directly rather than HTTP-fetching the app's
 * own route — the mistake `/long-term-lease` used to make, which made the page
 * fully dynamic and silently rendered defaults whenever `NEXTAUTH_URL` was
 * wrong.
 *
 * Every public function filters to `status: "published"` **at the query**.
 * Draft visibility is not a render concern: a draft must be unreachable even
 * by someone who guesses the path.
 */

function toRecord<T>(doc: unknown): T {
  const record = doc as Record<string, unknown> & {
    _id?: { toString(): string };
  };
  return {
    ...(record as unknown as T),
    _id: record._id ? String(record._id) : undefined,
  };
}

export async function getPublishedPageByPath(
  path: string,
): Promise<LandingPageRecord | null> {
  await dbConnect();

  const page = await LandingPage.findOne({ path, status: "published" })
    .select("-__v")
    .lean();

  return page ? toRecord<LandingPageRecord>(page) : null;
}

export async function getPublishedPaths(): Promise<string[]> {
  await dbConnect();

  const pages = await LandingPage.find({ status: "published" })
    .select("path")
    .lean();

  return (pages as { path: string }[]).map((page) => page.path);
}

/**
 * Every stored path, draft included.
 *
 * Only the sitemap needs this, to tell "not seeded yet" (which the render
 * falls back for, so it must be listed) apart from "deliberately unpublished"
 * (which must not be).
 */
export async function getAllLandingPaths(): Promise<string[]> {
  await dbConnect();

  const pages = await LandingPage.find({}).select("path").lean();

  return (pages as { path: string }[]).map((page) => page.path);
}

/**
 * The blocks a section list references, keyed by slug and ready for
 * `resolveSections`. One round trip regardless of how many references.
 */
export async function getPublishedBlocks(
  slugs: string[],
): Promise<Map<string, ContentSection[]>> {
  if (slugs.length === 0) return new Map();

  await dbConnect();

  const blocks = await SharedBlock.find({
    slug: { $in: slugs },
    status: "published",
  })
    .select("-__v")
    .lean();

  return new Map(
    (blocks as SharedBlockRecord[]).map((block) => [
      block.slug,
      block.sections ?? [],
    ]),
  );
}

/** Any status. Only ever called from `/admin/preview`, behind the proxy. */
export async function getPageForPreview(
  path: string,
): Promise<LandingPageRecord | null> {
  await dbConnect();

  const page = await LandingPage.findOne({ path }).select("-__v").lean();

  return page ? toRecord<LandingPageRecord>(page) : null;
}

/**
 * Preview resolves draft blocks too, so the admin can see what a page will
 * look like once everything on it is published. The renderer flags them.
 */
export async function getBlocksForPreview(
  slugs: string[],
): Promise<Map<string, ContentSection[]>> {
  if (slugs.length === 0) return new Map();

  await dbConnect();

  const blocks = await SharedBlock.find({ slug: { $in: slugs } })
    .select("-__v")
    .lean();

  return new Map(
    (blocks as SharedBlockRecord[]).map((block) => [
      block.slug,
      block.sections ?? [],
    ]),
  );
}

/**
 * The `…Safe` variants exist for the same reason `getPublicSettingsSafe` does.
 *
 * The catch-all and `sitemap.ts` are both prerendered, and CI builds against a
 * deliberately unreachable `MONGODB_URI` — so an uncaught read here is a red
 * build that `typecheck`, `lint`, `format:check` and `test:ci` all report
 * green.
 *
 * Logs `safeErrorSummary`, never `error.message`: mongoose messages embed the
 * offending values and `removeConsole` deliberately keeps `console.error` in
 * production builds.
 */
export async function getPublishedPageByPathSafe(
  context: string,
  path: string,
): Promise<LandingPageRecord | null> {
  try {
    const page = await getPublishedPageByPath(path);
    if (page) return page;

    // Nothing published at this path. For the 16 service-area URLs — and only
    // those — that has two very different causes, and they must not be
    // conflated:
    //
    //   no document at all  → the seed has not been run yet. Falling back
    //                         keeps these indexed URLs alive, so a deploy that
    //                         lands before someone clicks "Seed" cannot 404
    //                         them.
    //   document, not live  → an admin unpublished it deliberately. Respect
    //                         that, or taking a page down becomes impossible.
    //
    // The existence check is skipped entirely for any other path, so an
    // ordinary 404 still costs one query, not two.
    const fallback = serviceAreaFallbackPage(path);
    if (!fallback) return null;

    const stored = await LandingPage.exists({ path });
    return stored ? null : fallback;
  } catch (error) {
    console.error(
      `${context} could not read landing page:`,
      safeErrorSummary(error),
    );
    // With the database unreachable the 16 highest-value SEO URLs still render
    // real content, built by the same function that seeded them, and every
    // other path degrades to a clean 404.
    return serviceAreaFallbackPage(path);
  }
}

export async function getPublishedPathsSafe(
  context: string,
): Promise<string[]> {
  try {
    return await getPublishedPaths();
  } catch (error) {
    console.error(
      `${context} could not read landing paths:`,
      safeErrorSummary(error),
    );
    return [];
  }
}

export async function getAllLandingPathsSafe(
  context: string,
): Promise<string[]> {
  try {
    return await getAllLandingPaths();
  } catch (error) {
    console.error(
      `${context} could not read stored landing paths:`,
      safeErrorSummary(error),
    );
    return [];
  }
}

export async function getPublishedBlocksSafe(
  context: string,
  sections: LandingSection[],
): Promise<Map<string, ContentSection[]>> {
  try {
    return await getPublishedBlocks(blockSlugsIn(sections));
  } catch (error) {
    console.error(
      `${context} could not read shared blocks:`,
      safeErrorSummary(error),
    );
    // An empty map is the same outcome as a deleted block: the references
    // resolve to nothing and the rest of the page still renders.
    return new Map();
  }
}
