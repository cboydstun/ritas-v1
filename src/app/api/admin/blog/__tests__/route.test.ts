/**
 * @jest-environment node
 */
import { GET, POST } from "../route";
// These routes import from "next-auth/next" (the App Router entry point), not
// "next-auth" — mocking the wrong specifier leaves the real getServerSession
// in place, where it throws on headers() outside a request.
import { getServerSession } from "next-auth/next";
import { BlogPost } from "@/models/blogPost";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

const createdDocs: Record<string, unknown>[] = [];

jest.mock("@/models/blogPost", () => ({
  // The module also exports MODEL_RULE_MESSAGES, which every catch block maps
  // onto a 400. Replacing the whole module with a bare object would make it
  // undefined and turn that path into a 500.
  ...jest.requireActual("@/models/blogPost"),
  BlogPost: Object.assign(
    jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
      doc: Record<string, unknown>,
    ) {
      createdDocs.push(doc);
      Object.assign(this, doc);
      this.save = jest.fn().mockResolvedValue(undefined);
    }),
    { find: jest.fn(), countDocuments: jest.fn() },
  ),
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const find = BlogPost.find as unknown as jest.Mock;
const countDocuments = BlogPost.countDocuments as unknown as jest.Mock;

function chain(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["sort", "limit", "select"]) {
    query[method] = jest.fn(() => query);
  }
  query.lean = jest.fn().mockResolvedValue(result);
  return query;
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
  slug: "how-delivery-works",
  title: "How delivery works",
  body: "<p>We drop the machine off.</p>",
  ...overrides,
});

function asRequest(body: unknown) {
  return new Request("http://localhost/api/admin/blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  createdDocs.length = 0;
  mockSession.mockResolvedValue({ user: { role: "admin", name: "Chris" } });
  find.mockReturnValue(chain([]));
  countDocuments.mockResolvedValue(0);
});

describe("admin blog collection route", () => {
  describe("auth", () => {
    it.each([
      ["no session", null],
      ["a non-admin session", { user: { role: "viewer" } }],
    ])("GET rejects %s with 401", async (_label, session) => {
      mockSession.mockResolvedValue(session as never);

      const response = await GET(
        new Request("http://localhost/api/admin/blog") as never,
      );

      expect(response.status).toBe(401);
    });

    it("POST rejects a non-admin with 401", async () => {
      mockSession.mockResolvedValue(null);

      const response = await POST(asRequest(validBody()));

      expect(response.status).toBe(401);
      expect(createdDocs).toHaveLength(0);
    });
  });

  describe("GET", () => {
    it("returns drafts as well as published posts, newest first", async () => {
      const query = chain([{ slug: "a" }, { slug: "b" }]);
      find.mockReturnValue(query);
      countDocuments.mockResolvedValue(2);

      const response = await GET(
        new Request("http://localhost/api/admin/blog") as never,
      );

      expect(response.status).toBe(200);
      // No status filter: the admin list is the one view that shows drafts.
      expect(find).toHaveBeenCalledWith({});
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(response.headers.get("X-Total-Count")).toBe("2");
    });

    it("reports truncation when the cap bites", async () => {
      find.mockReturnValue(chain([{ slug: "a" }]));
      countDocuments.mockResolvedValue(900);

      const response = await GET(
        new Request("http://localhost/api/admin/blog") as never,
      );

      expect(response.headers.get("X-Result-Truncated")).toBe("true");
    });
  });

  describe("POST", () => {
    it("creates a draft and returns 201", async () => {
      const response = await POST(asRequest(validBody()));

      expect(response.status).toBe(201);
      expect(createdDocs[0]).toEqual(
        expect.objectContaining({
          slug: "how-delivery-works",
          status: "draft",
          author: "Chris",
        }),
      );
    });

    // The model hook rejects a published document with no publishedAt, so the
    // route has to stamp it rather than leaving it to a later edit.
    it("stamps publishedAt when created straight into published", async () => {
      await POST(asRequest(validBody({ status: "published" })));

      expect(createdDocs[0].publishedAt).toBeInstanceOf(Date);
    });

    it("leaves publishedAt unset on a draft", async () => {
      await POST(asRequest(validBody()));

      expect(createdDocs[0].publishedAt).toBeUndefined();
    });

    // The whole point of the explicit field list: a body naming _id,
    // createdAt or author must not reach the document.
    it("ignores fields the caller is not allowed to set", async () => {
      await POST(
        asRequest(
          validBody({
            _id: "507f1f77bcf86cd799439011",
            createdAt: "2020-01-01T00:00:00.000Z",
            author: "Someone Else",
          }),
        ),
      );

      expect(createdDocs[0]._id).toBeUndefined();
      expect(createdDocs[0].createdAt).toBeUndefined();
      expect(createdDocs[0].author).toBe("Chris");
    });

    it.each([
      ["a malformed slug", { slug: "Not A Slug" }],
      ["an empty title", { title: "" }],
      ["an empty body", { body: "" }],
      ["a script in the body", { body: "<script>alert(1)</script>" }],
      ["a remote cover image", { coverImagePath: "https://x.example/y.jpg" }],
    ])("rejects %s with 400", async (_label, overrides) => {
      const response = await POST(asRequest(validBody(overrides)));

      expect(response.status).toBe(400);
      expect(createdDocs).toHaveLength(0);
    });

    it("answers 409 when the slug is taken", async () => {
      (BlogPost as unknown as jest.Mock).mockImplementationOnce(function (
        this: Record<string, unknown>,
      ) {
        this.save = jest
          .fn()
          .mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
      });

      const response = await POST(asRequest(validBody()));

      expect(response.status).toBe(409);
    });
  });
});
