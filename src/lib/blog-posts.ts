import dbConnect from "@/lib/mongodb";
import { BlogPost } from "@/models/blogPost";
import { safeErrorSummary } from "@/lib/safe-error";
import type { BlogPostRecord } from "@/lib/blog";

/**
 * The public read side of the blog.
 *
 * Server components call these directly rather than HTTP-fetching the app's
 * own route — the mistake `/long-term-lease` used to make, which made the page
 * fully dynamic and silently rendered defaults whenever `NEXTAUTH_URL` was
 * wrong.
 *
 * Every function here filters to `status: "published"`. Draft visibility is
 * not a UI concern: a draft must be unreachable even by someone who guesses
 * the slug, so the filter lives at the query, not at the render.
 */

/** Fields the public pages need. `body` is excluded from list queries. */
const LIST_FIELDS = "-__v -body";

function toRecord(doc: unknown): BlogPostRecord {
  const post = doc as Record<string, unknown> & {
    _id?: { toString(): string };
  };
  return {
    ...(post as unknown as BlogPostRecord),
    _id: post._id ? String(post._id) : undefined,
  };
}

export async function getPublishedPosts(limit = 50): Promise<BlogPostRecord[]> {
  await dbConnect();

  const posts = await BlogPost.find({ status: "published" })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .select(LIST_FIELDS)
    .lean();

  return posts.map(toRecord);
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<BlogPostRecord | null> {
  await dbConnect();

  const post = await BlogPost.findOne({ slug, status: "published" })
    .select("-__v")
    .lean();

  return post ? toRecord(post) : null;
}

export async function getPublishedSlugs(): Promise<string[]> {
  await dbConnect();

  const posts = await BlogPost.find({ status: "published" })
    .sort({ publishedAt: -1 })
    .select("slug")
    .lean();

  return posts.map((post) => (post as { slug: string }).slug);
}

/**
 * The `…Safe` variants exist for the same reason `getPublicSettingsSafe` does.
 *
 * `/blog`, `/blog/[slug]` and `sitemap.ts` are all prerendered, and CI builds
 * against a deliberately unreachable `MONGODB_URI` — so an uncaught read here
 * is a red build that `typecheck`, `lint`, `format:check` and `test:ci` all
 * report green. Degrading to an empty list renders the empty state instead.
 *
 * Logs `safeErrorSummary`, never `error.message`: mongoose messages embed the
 * offending values and `removeConsole` deliberately keeps `console.error` in
 * production builds.
 */
export async function getPublishedPostsSafe(
  context: string,
): Promise<BlogPostRecord[]> {
  try {
    return await getPublishedPosts();
  } catch (error) {
    console.error(
      `${context} could not read blog posts:`,
      safeErrorSummary(error),
    );
    return [];
  }
}

export async function getPublishedPostBySlugSafe(
  context: string,
  slug: string,
): Promise<BlogPostRecord | null> {
  try {
    return await getPublishedPostBySlug(slug);
  } catch (error) {
    console.error(
      `${context} could not read blog post:`,
      safeErrorSummary(error),
    );
    return null;
  }
}

export async function getPublishedSlugsSafe(
  context: string,
): Promise<string[]> {
  try {
    return await getPublishedSlugs();
  } catch (error) {
    console.error(
      `${context} could not read blog slugs:`,
      safeErrorSummary(error),
    );
    return [];
  }
}
