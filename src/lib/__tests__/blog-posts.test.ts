/**
 * @jest-environment node
 */
import dbConnect from "@/lib/mongodb";
import { BlogPost } from "@/models/blogPost";
import {
  getPublishedPostBySlug,
  getPublishedPostBySlugSafe,
  getPublishedPosts,
  getPublishedPostsSafe,
  getPublishedSlugs,
  getPublishedSlugsSafe,
} from "@/lib/blog-posts";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/blogPost", () => ({
  BlogPost: { find: jest.fn(), findOne: jest.fn() },
}));

const mockConnect = dbConnect as jest.MockedFunction<typeof dbConnect>;
const find = BlogPost.find as jest.Mock;
const findOne = BlogPost.findOne as jest.Mock;

/** Stands in for the chained query builder mongoose returns. */
function chain(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["sort", "limit", "select"]) {
    query[method] = jest.fn(() => query);
  }
  query.lean = jest.fn().mockResolvedValue(result);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(true as never);
});

describe("getPublishedPosts", () => {
  it("filters to published and sorts by publish date", async () => {
    const query = chain([{ _id: "1", slug: "a", title: "A" }]);
    find.mockReturnValue(query);

    const posts = await getPublishedPosts();

    expect(find).toHaveBeenCalledWith({ status: "published" });
    expect(query.sort).toHaveBeenCalledWith({ publishedAt: -1 });
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("a");
  });

  // A draft must be unreachable even to someone who guesses the slug, so the
  // filter belongs at the query rather than at the render.
  it("serialises _id to a string", async () => {
    find.mockReturnValue(
      chain([{ _id: { toString: () => "abc" }, slug: "a", title: "A" }]),
    );

    const [post] = await getPublishedPosts();

    expect(typeof post._id).toBe("string");
  });
});

describe("getPublishedPostBySlug", () => {
  it("scopes the lookup to published posts", async () => {
    findOne.mockReturnValue(chain({ _id: "1", slug: "a", title: "A" }));

    await getPublishedPostBySlug("a");

    expect(findOne).toHaveBeenCalledWith({ slug: "a", status: "published" });
  });

  it("returns null for a draft or unknown slug", async () => {
    findOne.mockReturnValue(chain(null));

    expect(await getPublishedPostBySlug("missing")).toBeNull();
  });
});

describe("getPublishedSlugs", () => {
  it("returns just the slugs", async () => {
    find.mockReturnValue(chain([{ slug: "a" }, { slug: "b" }]));

    expect(await getPublishedSlugs()).toEqual(["a", "b"]);
  });
});

/**
 * These three are what keep an unreachable database from turning a prerender
 * into a red build. CI builds against a deliberately unreachable MONGODB_URI,
 * and `sitemap.ts`, `/blog` and `/blog/[slug]` all read through them.
 */
describe("the Safe variants", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockConnect.mockRejectedValue(new Error("ECONNREFUSED") as never);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("getPublishedPostsSafe degrades to an empty list", async () => {
    expect(await getPublishedPostsSafe("test")).toEqual([]);
  });

  it("getPublishedSlugsSafe degrades to an empty list", async () => {
    expect(await getPublishedSlugsSafe("test")).toEqual([]);
  });

  it("getPublishedPostBySlugSafe degrades to null", async () => {
    expect(await getPublishedPostBySlugSafe("test", "a")).toBeNull();
  });

  // safeErrorSummary, never error.message: mongoose messages embed the
  // offending values and removeConsole keeps console.error in production.
  it("logs a summary rather than the raw error", async () => {
    await getPublishedSlugsSafe("sitemap");

    const [, summary] = (console.error as jest.Mock).mock.calls[0];
    expect(summary).toEqual(expect.objectContaining({ name: "Error" }));
    expect(JSON.stringify(summary)).not.toContain("ECONNREFUSED");
  });
});
