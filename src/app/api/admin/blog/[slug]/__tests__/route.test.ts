/**
 * @jest-environment node
 */
import { GET, PUT, DELETE } from "../route";
import { getServerSession } from "next-auth/next";
import { BlogPost } from "@/models/blogPost";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/models/blogPost", () => ({
  ...jest.requireActual("@/models/blogPost"),
  BlogPost: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const findOne = BlogPost.findOne as jest.Mock;
const findOneAndUpdate = BlogPost.findOneAndUpdate as jest.Mock;
const findOneAndDelete = BlogPost.findOneAndDelete as jest.Mock;

/**
 * Stands in for a mongoose query, which the route consumes two different ways:
 * `PUT` awaits `findOne` directly to read the stored document, while `GET`
 * chains `.select().lean()`. A stub that only did one of those let a
 * `mockResolvedValue` shadow the chain, so GET's happy path was never really
 * executed — it 500'd on `.select` of a promise and no test noticed.
 */
function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  query.select = jest.fn(() => query);
  query.lean = jest.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return query;
}

const storedDraft = { slug: "a-post", title: "A post", status: "draft" };

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function putRequest(body: unknown) {
  return new Request("http://localhost/api/admin/blog/a-post", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const bareRequest = () =>
  new Request("http://localhost/api/admin/blog/a-post") as never;

/** The `$set` the route built on the most recent findOneAndUpdate call. */
function lastSet(): Record<string, unknown> {
  return findOneAndUpdate.mock.calls.at(-1)?.[1].$set ?? {};
}

function lastUnset(): Record<string, unknown> | undefined {
  return findOneAndUpdate.mock.calls.at(-1)?.[1].$unset;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { role: "admin", name: "Chris" } });
  findOne.mockReturnValue(chain(storedDraft));
  findOneAndUpdate.mockReturnValue(chain({ ...storedDraft }));
  findOneAndDelete.mockResolvedValue(storedDraft);
});

describe("admin blog [slug] route", () => {
  describe("auth", () => {
    it.each([
      ["GET", () => GET(bareRequest(), params("a-post"))],
      ["PUT", () => PUT(putRequest({ title: "x" }), params("a-post"))],
      ["DELETE", () => DELETE(bareRequest(), params("a-post"))],
    ])("%s rejects a missing session with 401", async (_label, call) => {
      mockSession.mockResolvedValue(null);

      expect((await call()).status).toBe(401);
    });
  });

  // The resource is keyed by slug, so there is no ObjectId to validate. A
  // malformed slug cannot match anything.
  it("answers 404 for a malformed slug rather than querying", async () => {
    const response = await GET(bareRequest(), params("Not A Slug"));

    expect(response.status).toBe(404);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("returns a post of any status to the admin", async () => {
    const response = await GET(bareRequest(), params("a-post"));

    expect(response.status).toBe(200);
    // No status filter here: the admin edits drafts, and this is the read the
    // edit form uses to fetch the body the list query leaves out.
    expect(findOne).toHaveBeenCalledWith({ slug: "a-post" });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ slug: "a-post", status: "draft" }),
    );
  });

  it("answers 404 when the post does not exist", async () => {
    findOne.mockReturnValue(chain(null));

    expect((await GET(bareRequest(), params("missing"))).status).toBe(404);
  });

  describe("PUT", () => {
    it("updates only the fields the caller sent", async () => {
      await PUT(putRequest({ title: "New title" }), params("a-post"));

      const set = lastSet();
      expect(set.title).toBe("New title");
      expect(set).toHaveProperty("updatedAt");
      expect(set).not.toHaveProperty("body");
      expect(set).not.toHaveProperty("slug");
    });

    it("ignores fields outside the whitelist", async () => {
      await PUT(
        putRequest({
          title: "New title",
          _id: "507f1f77bcf86cd799439011",
          createdAt: "2020-01-01T00:00:00.000Z",
          author: "Someone Else",
        }),
        params("a-post"),
      );

      const set = lastSet();
      expect(set).not.toHaveProperty("_id");
      expect(set).not.toHaveProperty("createdAt");
      expect(set).not.toHaveProperty("author");
    });

    it("rejects an empty body with 400", async () => {
      const response = await PUT(putRequest({}), params("a-post"));

      expect(response.status).toBe(400);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    describe("publishing", () => {
      it("stamps publishedAt on the first publish", async () => {
        await PUT(putRequest({ status: "published" }), params("a-post"));

        expect(lastSet().publishedAt).toBeInstanceOf(Date);
      });

      // A published post's date is a fact about when it went live, not about
      // when it was last touched — the same discipline that keeps
      // PUT /api/admin/orders/[id] from repricing a months-old order.
      it("does not re-stamp a post that is already published", async () => {
        const published = {
          ...storedDraft,
          status: "published",
          publishedAt: new Date("2026-01-01"),
        };
        findOne.mockReturnValue(chain(published));

        await PUT(putRequest({ title: "Edited" }), params("a-post"));

        expect(lastSet()).not.toHaveProperty("publishedAt");
      });

      it("does not re-stamp on a republish after unpublishing", async () => {
        const unpublished = {
          ...storedDraft,
          publishedAt: new Date("2026-01-01"),
        };
        findOne.mockReturnValue(chain(unpublished));

        await PUT(putRequest({ status: "published" }), params("a-post"));

        expect(lastSet()).not.toHaveProperty("publishedAt");
      });
    });

    describe("renaming", () => {
      it("moves the post when the body carries a new slug", async () => {
        await PUT(putRequest({ slug: "new-slug" }), params("a-post"));

        expect(findOneAndUpdate).toHaveBeenCalledWith(
          { slug: "a-post" },
          expect.objectContaining({
            $set: expect.objectContaining({ slug: "new-slug" }),
          }),
          expect.objectContaining({ new: true, runValidators: true }),
        );
      });

      // The fix for this is to pick a different slug, so the client needs to
      // be told specifically rather than shown a generic 500.
      it("answers 409 when the new slug is taken", async () => {
        findOneAndUpdate.mockImplementation(() => {
          throw Object.assign(new Error("dup"), { code: 11000 });
        });

        const response = await PUT(
          putRequest({ slug: "taken" }),
          params("a-post"),
        );

        expect(response.status).toBe(409);
      });
    });

    // Mongoose skips `undefined`, so clearing an optional field needs $unset
    // rather than $set: undefined.
    it("clears an optional field sent as an empty string", async () => {
      await PUT(putRequest({ excerpt: "" }), params("a-post"));

      expect(lastUnset()).toEqual({ excerpt: "" });
      expect(lastSet()).not.toHaveProperty("excerpt");
    });

    it("sets an optional field that carries a value", async () => {
      await PUT(putRequest({ excerpt: "A summary" }), params("a-post"));

      expect(lastSet().excerpt).toBe("A summary");
      expect(lastUnset()).toBeUndefined();
    });

    it("answers 404 when the post is deleted mid-request", async () => {
      findOneAndUpdate.mockReturnValue(chain(null));

      const response = await PUT(
        putRequest({ title: "New" }),
        params("a-post"),
      );

      expect(response.status).toBe(404);
    });

    it("rejects a script in the body with 400", async () => {
      const response = await PUT(
        putRequest({ body: "<script>alert(1)</script>" }),
        params("a-post"),
      );

      expect(response.status).toBe(400);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("deletes by slug", async () => {
      const response = await DELETE(bareRequest(), params("a-post"));

      expect(response.status).toBe(200);
      expect(findOneAndDelete).toHaveBeenCalledWith({ slug: "a-post" });
    });

    it("answers 404 for a slug that is not there", async () => {
      findOneAndDelete.mockResolvedValue(null);

      expect((await DELETE(bareRequest(), params("gone"))).status).toBe(404);
    });
  });
});
