/**
 * @jest-environment node
 *
 * The read side. What matters here is not the happy path but the two rules
 * that are easy to get wrong: drafts are excluded *at the query*, and the
 * `…Safe` wrappers degrade rather than throw, because CI prerenders against a
 * deliberately unreachable MONGODB_URI.
 */

import {
  getPublishedBlocksSafe,
  getPublishedPageByPathSafe,
  getAllLandingPaths,
  getAllLandingPathsSafe,
  getPublishedPaths,
  getPublishedPathsSafe,
  getPageForPreview,
  getBlocksForPreview,
  getPublishedBlocks,
} from "@/lib/landing-page-data";
import { LandingPage } from "@/models/landingPage";
import { SharedBlock } from "@/models/sharedBlock";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/landingPage", () => ({
  LandingPage: { find: jest.fn(), findOne: jest.fn(), exists: jest.fn() },
}));

jest.mock("@/models/sharedBlock", () => ({
  SharedBlock: { find: jest.fn() },
}));

interface QueryStub {
  select: jest.Mock;
  lean: jest.Mock;
}

const chain = (result: unknown): QueryStub => {
  const link: QueryStub = {
    select: jest.fn(() => link),
    lean: jest.fn().mockResolvedValue(result),
  };
  return link;
};

const throwing = (): QueryStub => {
  const link: QueryStub = {
    select: jest.fn(() => link),
    lean: jest.fn().mockRejectedValue(new Error("no connection")),
  };
  return link;
};

describe("landing page reads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (LandingPage.exists as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // A draft must be unreachable even by someone who guesses the path, so the
  // filter belongs at the query rather than at the render.
  it("filters published pages at the query", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(chain({ path: "/x" }));

    await getPublishedPageByPathSafe("test", "/x");

    expect(LandingPage.findOne).toHaveBeenCalledWith({
      path: "/x",
      status: "published",
    });
  });

  it("does not filter by status in preview", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(chain({ path: "/x" }));

    await getPageForPreview("/x");

    expect(LandingPage.findOne).toHaveBeenCalledWith({ path: "/x" });
  });

  it("serialises _id to a string for the client", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(
      chain({ path: "/x", _id: { toString: () => "abc" } }),
    );

    const page = await getPublishedPageByPathSafe("test", "/x");

    expect(page?._id).toBe("abc");
  });

  // The sitemap needs both: published paths are what it lists, and the full
  // stored set is how it tells "not seeded yet" (which renders, via the
  // fallback) from "unpublished" (which 404s).
  it("returns every stored path, draft included", async () => {
    (LandingPage.find as jest.Mock).mockReturnValue(
      chain([{ path: "/a" }, { path: "/draft" }]),
    );

    expect(await getAllLandingPaths()).toEqual(["/a", "/draft"]);
    expect(LandingPage.find).toHaveBeenCalledWith({});
  });

  it("degrades the stored-path read to an empty list", async () => {
    (LandingPage.find as jest.Mock).mockReturnValue(throwing());

    expect(await getAllLandingPathsSafe("sitemap")).toEqual([]);
  });

  it("returns the published paths", async () => {
    (LandingPage.find as jest.Mock).mockReturnValue(
      chain([{ path: "/a" }, { path: "/b" }]),
    );

    expect(await getPublishedPaths()).toEqual(["/a", "/b"]);
  });

  describe("shared block resolution", () => {
    it("asks for only the slugs a page actually references, published only", async () => {
      (SharedBlock.find as jest.Mock).mockReturnValue(chain([]));

      await getPublishedBlocksSafe("test", [
        { kind: "blockRef", blockSlug: "a" },
        { kind: "cta" },
        { kind: "blockRef", blockSlug: "a" },
        { kind: "blockRef", blockSlug: "b" },
      ]);

      expect(SharedBlock.find).toHaveBeenCalledWith({
        slug: { $in: ["a", "b"] },
        status: "published",
      });
    });

    it("makes no query at all when nothing is referenced", async () => {
      await getPublishedBlocks([]);

      expect(SharedBlock.find).not.toHaveBeenCalled();
    });

    it("keys the map by slug", async () => {
      (SharedBlock.find as jest.Mock).mockReturnValue(
        chain([{ slug: "a", sections: [{ kind: "cta" }] }]),
      );

      const blocks = await getPublishedBlocks(["a"]);

      expect(blocks.get("a")).toEqual([{ kind: "cta" }]);
    });

    it("includes drafts in preview", async () => {
      (SharedBlock.find as jest.Mock).mockReturnValue(chain([]));

      await getBlocksForPreview(["a"]);

      expect(SharedBlock.find).toHaveBeenCalledWith({ slug: { $in: ["a"] } });
    });
  });

  // Not optional: an uncaught read during prerender is a red build that
  // typecheck, lint, format:check and test:ci all report green.
  describe("degrading when the database is unreachable", () => {
    it("a page read becomes null", async () => {
      (LandingPage.findOne as jest.Mock).mockReturnValue(throwing());

      expect(await getPublishedPageByPathSafe("test", "/x")).toBeNull();
    });

    it("a path list becomes empty", async () => {
      (LandingPage.find as jest.Mock).mockReturnValue(throwing());

      expect(await getPublishedPathsSafe("test")).toEqual([]);
    });

    it("a block read becomes an empty map, so the rest of the page renders", async () => {
      (SharedBlock.find as jest.Mock).mockReturnValue(throwing());

      const blocks = await getPublishedBlocksSafe("test", [
        { kind: "blockRef", blockSlug: "a" },
      ]);

      expect(blocks.size).toBe(0);
    });

    // safeErrorSummary, never error.message: mongoose messages embed the
    // offending values and removeConsole keeps console.error in production.
    it("logs a summary rather than the raw error", async () => {
      (LandingPage.find as jest.Mock).mockReturnValue(throwing());

      await getPublishedPathsSafe("sitemap");

      const [, summary] = (console.error as jest.Mock).mock.calls[0];
      expect(summary).toEqual({ name: "Error" });
    });
  });
});

/**
 * The two reasons a service-area path can have nothing published, which look
 * identical from the route and must not be treated the same.
 */
describe("the service-area fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders a known area when no document exists yet, so an unseeded deploy does not 404 it", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(chain(null));
    (LandingPage.exists as jest.Mock).mockResolvedValue(null);

    const page = await getPublishedPageByPathSafe(
      "test",
      "/service-area/olmos-park",
    );

    expect(page?.title).toBe("Margarita Machine Rental in Olmos Park");
  });

  // Otherwise taking a page down would be impossible.
  it("respects a deliberate unpublish", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(chain(null));
    (LandingPage.exists as jest.Mock).mockResolvedValue({ _id: "abc" });

    expect(
      await getPublishedPageByPathSafe("test", "/service-area/olmos-park"),
    ).toBeNull();
  });

  it("costs no extra query for an ordinary 404", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(chain(null));

    expect(await getPublishedPageByPathSafe("test", "/anything")).toBeNull();
    expect(LandingPage.exists).not.toHaveBeenCalled();
  });

  it("renders a known area when the database is unreachable", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(throwing());

    const page = await getPublishedPageByPathSafe(
      "test",
      "/service-area/stone-oak",
    );

    expect(page?.title).toBe("Margarita Machine Rental in Stone Oak");
  });

  it("still 404s an unknown path during an outage", async () => {
    (LandingPage.findOne as jest.Mock).mockReturnValue(throwing());

    expect(await getPublishedPageByPathSafe("test", "/weddings")).toBeNull();
  });
});
