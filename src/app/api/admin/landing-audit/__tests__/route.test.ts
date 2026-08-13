/**
 * @jest-environment node
 */
import { POST } from "../route";
// The route imports from "next-auth/next", not "next-auth" — mocking the wrong
// specifier leaves the real getServerSession in place, where it throws on
// headers() outside a request.
import { getServerSession } from "next-auth/next";
import { LandingPage } from "@/models/landingPage";
import { SharedBlock } from "@/models/sharedBlock";
import type { LandingSection } from "@/lib/landing";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/models/landingPage", () => ({
  ...jest.requireActual("@/models/landingPage"),
  LandingPage: { find: jest.fn() },
}));

jest.mock("@/models/sharedBlock", () => ({
  ...jest.requireActual("@/models/sharedBlock"),
  SharedBlock: { find: jest.fn() },
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const findPages = LandingPage.find as unknown as jest.Mock;
const findBlocks = SharedBlock.find as unknown as jest.Mock;

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  query.select = jest.fn(() => query);
  query.lean = jest.fn().mockResolvedValue(result);
  return query;
}

const SHARED_SECTIONS: LandingSection[] = [
  {
    kind: "richText",
    html: "<p>the quick brown fox jumps over the lazy dog and then runs away again</p>",
  },
];
const SHARED_TEXT =
  "the quick brown fox jumps over the lazy dog and then runs away again";

function asRequest(body: unknown) {
  return new Request("http://localhost/api/admin/landing-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { role: "admin", name: "Chris" } });
  findPages.mockReturnValue(chain([]));
  findBlocks.mockReturnValue(chain([]));
});

describe("landing audit route", () => {
  it.each([
    ["no session", null],
    ["a non-admin session", { user: { role: "viewer" } }],
  ])("rejects %s with 401", async (_label, session) => {
    mockSession.mockResolvedValue(session as never);

    const response = await POST(asRequest({ text: "words" }));

    expect(response.status).toBe(401);
    expect(findPages).not.toHaveBeenCalled();
  });

  it("returns an empty set of facts when there is nothing to compare against", async () => {
    const response = await POST(asRequest({ text: SHARED_TEXT }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: null,
      titleCollision: null,
      descriptionCollision: null,
      publishedPaths: [],
      publishedBlockSlugs: [],
    });
  });

  // Without the $ne the page would always match itself at similarity 1 and the
  // check would be permanently, uselessly red.
  it("excludes the page's own path from the comparison", async () => {
    await POST(asRequest({ path: "/mine", text: SHARED_TEXT }));

    expect(findPages).toHaveBeenCalledWith({ path: { $ne: "/mine" } });
  });

  it("queries everything when the page has no path yet", async () => {
    await POST(asRequest({ text: SHARED_TEXT }));

    expect(findPages).toHaveBeenCalledWith({});
  });

  it("returns the closest match, not merely the first", async () => {
    findPages.mockReturnValue(
      chain([
        {
          path: "/unrelated",
          sections: [
            {
              kind: "richText",
              html: "<p>completely different words here</p>",
            },
          ],
        },
        { path: "/near-copy", sections: SHARED_SECTIONS },
      ]),
    );

    const response = await POST(asRequest({ text: SHARED_TEXT }));
    const data = await response.json();

    expect(data.duplicate.path).toBe("/near-copy");
    expect(data.duplicate.similarity).toBe(1);
  });

  it("tolerates a stored page with no sections", async () => {
    findPages.mockReturnValue(chain([{ path: "/empty" }]));

    const response = await POST(asRequest({ text: SHARED_TEXT }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.duplicate).toEqual({ path: "/empty", similarity: 0 });
  });

  it("reports a title collision, ignoring case and spacing", async () => {
    findPages.mockReturnValue(
      chain([{ path: "/other", seoTitle: "Margarita  Machine Rental" }]),
    );

    const response = await POST(
      asRequest({ text: "x", seoTitle: "margarita machine rental" }),
    );

    await expect(response.json()).resolves.toMatchObject({
      titleCollision: "/other",
      descriptionCollision: null,
    });
  });

  // The rendered tag is `seoTitle || title`, so a page with no SEO override
  // still collides on the title it actually ships.
  it("falls back to the stored title when the other page has no SEO title", async () => {
    findPages.mockReturnValue(chain([{ path: "/other", title: "Weddings" }]));

    const response = await POST(asRequest({ text: "x", seoTitle: "Weddings" }));

    await expect(response.json()).resolves.toMatchObject({
      titleCollision: "/other",
    });
  });

  it("reports a description collision", async () => {
    findPages.mockReturnValue(
      chain([{ path: "/other", seoDescription: "Same snippet." }]),
    );

    const response = await POST(
      asRequest({ text: "x", seoDescription: "Same snippet." }),
    );

    await expect(response.json()).resolves.toMatchObject({
      descriptionCollision: "/other",
    });
  });

  // An unset field is not a collision with every other unset field.
  it("does not report a collision when the page has no title or description", async () => {
    findPages.mockReturnValue(chain([{ path: "/other" }]));

    const response = await POST(asRequest({ text: "x" }));

    await expect(response.json()).resolves.toMatchObject({
      titleCollision: null,
      descriptionCollision: null,
    });
  });

  it("lists only published paths as resolvable link targets", async () => {
    findPages.mockReturnValue(
      chain([
        { path: "/live", status: "published" },
        { path: "/hidden", status: "draft" },
      ]),
    );

    const response = await POST(asRequest({ text: "x" }));

    await expect(response.json()).resolves.toMatchObject({
      publishedPaths: ["/live"],
    });
  });

  it("asks for published shared blocks only", async () => {
    findBlocks.mockReturnValue(chain([{ slug: "delivery-includes" }]));

    const response = await POST(asRequest({ text: "x" }));

    expect(findBlocks).toHaveBeenCalledWith({ status: "published" });
    await expect(response.json()).resolves.toMatchObject({
      publishedBlockSlugs: ["delivery-includes"],
    });
  });

  it("rejects text over the length bound with 400", async () => {
    const response = await POST(asRequest({ text: "x".repeat(100_001) }));

    expect(response.status).toBe(400);
    expect(findPages).not.toHaveBeenCalled();
  });
});
