/**
 * @jest-environment node
 */
import { POST } from "../route";
import { PUT, DELETE } from "../[slug]/route";
import { SharedBlock } from "@/models/sharedBlock";
import { LandingPage } from "@/models/landingPage";
import { getServerSession } from "next-auth/next";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const createdDocs: Record<string, unknown>[] = [];
jest.mock("@/models/sharedBlock", () => ({
  ...jest.requireActual("@/models/sharedBlock"),
  SharedBlock: Object.assign(
    jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
      doc: Record<string, unknown>,
    ) {
      createdDocs.push(doc);
      Object.assign(this, doc);
      this.save = jest.fn().mockResolvedValue(undefined);
    }),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    },
  ),
}));

jest.mock("@/models/landingPage", () => ({
  ...jest.requireActual("@/models/landingPage"),
  LandingPage: { find: jest.fn() },
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

interface QueryStub {
  sort: jest.Mock;
  limit: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

const chain = (result: unknown): QueryStub => {
  const link: QueryStub = {
    sort: jest.fn(() => link),
    limit: jest.fn(() => link),
    select: jest.fn(() => link),
    lean: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return link;
};

const validBody = (overrides: Record<string, unknown> = {}) => ({
  slug: "delivery-includes",
  name: "What delivery includes",
  sections: [{ kind: "features", items: [{ body: "Delivery and pickup." }] }],
  ...overrides,
});

const asRequest = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/admin/shared-blocks", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const post = (body: unknown) =>
  POST(asRequest(body) as never as Parameters<typeof POST>[0]);

const put = (body: unknown, slug = "delivery-includes") =>
  PUT(asRequest(body, "PUT") as never as Parameters<typeof PUT>[0], {
    params: Promise.resolve({ slug }),
  });

const del = (slug = "delivery-includes", query = "") =>
  DELETE(
    new Request(`http://localhost/x${query}`, {
      method: "DELETE",
    }) as never as Parameters<typeof DELETE>[0],
    { params: Promise.resolve({ slug }) },
  );

describe("admin shared-block routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdDocs.length = 0;
    mockSession.mockResolvedValue({
      user: { role: "admin", name: "admin" },
    } as never);
    (SharedBlock.findOneAndUpdate as jest.Mock).mockReturnValue(
      chain({ slug: "delivery-includes" }),
    );
    (SharedBlock.findOneAndDelete as jest.Mock).mockResolvedValue({
      slug: "delivery-includes",
    });
    (LandingPage.find as jest.Mock).mockReturnValue(chain([]));
  });

  it.each([
    ["POST", () => post(validBody())],
    ["PUT", () => put({ name: "x" })],
    ["DELETE", () => del()],
  ])("%s rejects a non-admin", async (_label, call) => {
    mockSession.mockResolvedValue({ user: { role: "customer" } } as never);

    expect((await call()).status).toBe(401);
  });

  it("creates a block as a draft by default", async () => {
    const response = await post(validBody());

    expect(response.status).toBe(201);
    expect(createdDocs[0]).toMatchObject({ status: "draft" });
  });

  // A block that cannot express a reference cannot participate in a cycle, so
  // resolution needs no depth counter and no visited set.
  it("rejects a blockRef nested inside a block", async () => {
    const response = await post(
      validBody({ sections: [{ kind: "blockRef", blockSlug: "other" }] }),
    );

    expect(response.status).toBe(400);
  });

  describe("DELETE reference guard", () => {
    it("refuses while pages still insert the block, and names them", async () => {
      (LandingPage.find as jest.Mock).mockReturnValue(
        chain([{ path: "/service-area/olmos-park" }, { path: "/a" }]),
      );

      const response = await del();
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.paths).toEqual(["/service-area/olmos-park", "/a"]);
      expect(body.message).toMatch(/2 pages/);
      expect(SharedBlock.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("deletes anyway when the admin forces it", async () => {
      (LandingPage.find as jest.Mock).mockReturnValue(chain([{ path: "/a" }]));

      const response = await del("delivery-includes", "?force=1");

      expect(response.status).toBe(200);
      expect(SharedBlock.findOneAndDelete).toHaveBeenCalled();
    });

    it("deletes an unreferenced block without a fight", async () => {
      expect((await del()).status).toBe(200);
    });
  });

  // Editing one block changes every page that inserts it, and each of those is
  // a separately cached ISR entry.
  it("revalidates every referencing page after an edit", async () => {
    const { revalidatePath } = jest.requireMock("next/cache");
    (LandingPage.find as jest.Mock).mockReturnValue(
      chain([{ path: "/a" }, { path: "/b" }]),
    );

    await put({ name: "Renamed" });

    expect(revalidatePath).toHaveBeenCalledWith("/a");
    expect(revalidatePath).toHaveBeenCalledWith("/b");
  });
});
