/**
 * @jest-environment node
 */
import { POST } from "../route";
// The route imports from "next-auth/next", not "next-auth" — mocking the wrong
// specifier leaves the real getServerSession in place, where it throws on
// headers() outside a request.
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
  BlogPost: { find: jest.fn() },
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const find = BlogPost.find as unknown as jest.Mock;

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  query.select = jest.fn(() => query);
  query.lean = jest.fn().mockResolvedValue(result);
  return query;
}

const SHARED =
  "the quick brown fox jumps over the lazy dog and then runs away again";

function asRequest(body: unknown) {
  return new Request("http://localhost/api/admin/blog-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { role: "admin", name: "Chris" } });
  find.mockReturnValue(chain([]));
});

describe("blog audit route", () => {
  it.each([
    ["no session", null],
    ["a non-admin session", { user: { role: "viewer" } }],
  ])("rejects %s with 401", async (_label, session) => {
    mockSession.mockResolvedValue(session as never);

    const response = await POST(asRequest({ body: "text" }));

    expect(response.status).toBe(401);
    expect(find).not.toHaveBeenCalled();
  });

  it("returns null when there is nothing to compare against", async () => {
    const response = await POST(asRequest({ body: SHARED }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ duplicate: null });
  });

  // Without the $ne the post would always match itself at similarity 1 and the
  // check would be permanently, uselessly red.
  it("excludes the post's own slug from the comparison", async () => {
    await POST(asRequest({ slug: "mine", body: SHARED }));

    expect(find).toHaveBeenCalledWith({ slug: { $ne: "mine" } });
  });

  it("queries everything when the post has no slug yet", async () => {
    await POST(asRequest({ body: SHARED }));

    expect(find).toHaveBeenCalledWith({});
  });

  it("returns the closest match, not merely the first", async () => {
    find.mockReturnValue(
      chain([
        {
          slug: "unrelated",
          body: "completely different words entirely here now",
        },
        { slug: "near-copy", body: SHARED },
      ]),
    );

    const response = await POST(asRequest({ body: SHARED }));
    const data = await response.json();

    expect(data.duplicate.slug).toBe("near-copy");
    expect(data.duplicate.similarity).toBe(1);
  });

  it("tolerates a stored post with no body", async () => {
    find.mockReturnValue(chain([{ slug: "empty" }]));

    const response = await POST(asRequest({ body: SHARED }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: { slug: "empty", similarity: 0 },
    });
  });

  it("rejects a body over the model's length bound with 400", async () => {
    const response = await POST(asRequest({ body: "x".repeat(100_001) }));

    expect(response.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });
});
