/**
 * @jest-environment node
 */
import { GET, POST } from "../route";
import { GET as GET_ONE, PUT, DELETE } from "../[...path]/route";
import { LandingPage } from "@/models/landingPage";
// These routes import from "next-auth/next" (the App Router entry point),
// not "next-auth" — mocking the wrong specifier leaves the real
// getServerSession in place, where it throws on headers() outside a request.
import { getServerSession } from "next-auth/next";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const createdDocs: Record<string, unknown>[] = [];
jest.mock("@/models/landingPage", () => ({
  // Only the model is stubbed. The module also exports MODEL_RULE_MESSAGES,
  // which every catch block maps onto a 400; replacing the whole module with
  // a bare object would make it undefined and turn those paths into 500s.
  ...jest.requireActual("@/models/landingPage"),
  LandingPage: Object.assign(
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

/**
 * A stand-in for a mongoose Query: chainable like the list route builds it
 * (`.sort().limit().select().lean()`), and directly awaitable like PUT does
 * when it reads the existing document. Without the `then` the PUT read
 * resolves to the stub itself, and every field on it reads as undefined.
 */
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
  path: "/margarita-machine-rental-weddings",
  title: "Wedding margarita machine rental",
  sections: [{ kind: "hero", heading: "Frozen drinks for your reception" }],
  ...overrides,
});

const asRequest = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/admin/landing-pages", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const list = () =>
  GET(
    new Request(
      "http://localhost/api/admin/landing-pages",
    ) as never as Parameters<typeof GET>[0],
  );

const post = (body: unknown) =>
  POST(asRequest(body) as never as Parameters<typeof POST>[0]);

const SEGMENTS = ["margarita-machine-rental-weddings"];

const getOne = (path = SEGMENTS) =>
  GET_ONE(
    new Request("http://localhost/x") as never as Parameters<typeof GET_ONE>[0],
    { params: Promise.resolve({ path }) },
  );

const put = (body: unknown, path = SEGMENTS) =>
  PUT(asRequest(body, "PUT") as never as Parameters<typeof PUT>[0], {
    params: Promise.resolve({ path }),
  });

const del = (path = SEGMENTS) =>
  DELETE(
    new Request("http://localhost/x", {
      method: "DELETE",
    }) as never as Parameters<typeof DELETE>[0],
    { params: Promise.resolve({ path }) },
  );

const lastCreated = () => createdDocs[createdDocs.length - 1];

describe("admin landing-page routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdDocs.length = 0;
    mockSession.mockResolvedValue({
      user: { role: "admin", name: "admin" },
    } as never);
    (LandingPage.find as jest.Mock).mockReturnValue(chain([]));
    (LandingPage.countDocuments as jest.Mock).mockResolvedValue(0);
    (LandingPage.findOne as jest.Mock).mockReturnValue(
      chain({ path: "/margarita-machine-rental-weddings" }),
    );
    (LandingPage.findOneAndUpdate as jest.Mock).mockReturnValue(
      chain({ path: "/margarita-machine-rental-weddings" }),
    );
    (LandingPage.findOneAndDelete as jest.Mock).mockResolvedValue({
      path: "/margarita-machine-rental-weddings",
    });
  });

  describe("auth", () => {
    it.each([
      ["GET list", () => list()],
      ["POST", () => post(validBody())],
      ["GET one", () => getOne()],
      ["PUT", () => put({ title: "x" })],
      ["DELETE", () => del()],
    ])("%s rejects an anonymous caller", async (_label, call) => {
      mockSession.mockResolvedValue(null);

      expect((await call()).status).toBe(401);
    });

    it.each([
      ["GET list", () => list()],
      ["POST", () => post(validBody())],
      ["PUT", () => put({ title: "x" })],
      ["DELETE", () => del()],
    ])("%s rejects a signed-in non-admin", async (_label, call) => {
      mockSession.mockResolvedValue({ user: { role: "customer" } } as never);

      expect((await call()).status).toBe(401);
    });
  });

  describe("GET list", () => {
    it("reports the total and whether the result was truncated", async () => {
      (LandingPage.find as jest.Mock).mockReturnValue(chain([{ path: "/a" }]));
      (LandingPage.countDocuments as jest.Mock).mockResolvedValue(9);

      const response = await list();

      expect(response.headers.get("X-Total-Count")).toBe("9");
      expect(response.headers.get("X-Result-Truncated")).toBe("true");
    });

    // The editor re-fetches the single page for this reason; opening the form
    // on a projection without sections would save an empty page over a full one.
    it("excludes sections from the table projection", async () => {
      const link = chain([]);
      (LandingPage.find as jest.Mock).mockReturnValue(link);

      await list();

      expect(link.select).toHaveBeenCalledWith("-__v -sections");
    });
  });

  describe("POST", () => {
    it("creates a page and answers 201", async () => {
      const response = await post(validBody());

      expect(response.status).toBe(201);
      expect(lastCreated()).toMatchObject({
        path: "/margarita-machine-rental-weddings",
        status: "draft",
      });
    });

    it("never writes fields the caller supplied outside the whitelist", async () => {
      await post(validBody({ _id: "deadbeef", createdAt: "2020-01-01" }));

      expect(lastCreated()).not.toHaveProperty("_id");
      expect(lastCreated()).not.toHaveProperty("createdAt");
    });

    // 400, not 409: a reserved path is a different failure from a taken one,
    // and the fixes differ.
    it("rejects a path an existing route owns with a 400", async () => {
      const response = await post(validBody({ path: "/order" }));

      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/reserved/);
    });

    it("rejects an unknown section kind", async () => {
      const response = await post(
        validBody({ sections: [{ kind: "carousel" }] }),
      );

      expect(response.status).toBe(400);
    });

    // The regression the blog's coverImagePath carries: an optional field with
    // a refine rejects the "" an admin form sends for a blank input.
    it("accepts the empty strings a form sends for blank optional fields", async () => {
      const response = await post(
        validBody({ seoTitle: "", seoDescription: "", ogImagePath: "" }),
      );

      expect(response.status).toBe(201);
    });

    it("stamps publishedAt only when created straight into published", async () => {
      await post(validBody({ status: "published" }));
      expect(lastCreated().publishedAt).toBeInstanceOf(Date);

      await post(validBody({ status: "draft" }));
      expect(lastCreated().publishedAt).toBeUndefined();
    });

    it("answers 409 for a path that is already taken", async () => {
      (LandingPage as unknown as jest.Mock).mockImplementationOnce(() => {
        throw Object.assign(new Error("dup"), { code: 11000 });
      });

      expect((await post(validBody())).status).toBe(409);
    });
  });

  describe("path handling on the item route", () => {
    // A malformed path cannot match anything stored, so it is answered before
    // the database is touched.
    it.each([
      ["a dot", ["og-image.jpg"]],
      ["uppercase", ["Weddings"]],
      ["too many segments", ["a", "b", "c", "d", "e"]],
      ["nothing at all", []],
    ])("answers 404 for %s without querying", async (_label, segments) => {
      const response = await getOne(segments);

      expect(response.status).toBe(404);
      expect(LandingPage.findOne).not.toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    it("rejects an update that names no fields", async () => {
      expect((await put({})).status).toBe(400);
    });

    it("replaces the whole sections array rather than patching it", async () => {
      const sections = [{ kind: "cta", headline: "Book now" }];

      await put({ sections });

      const [, update] = (LandingPage.findOneAndUpdate as jest.Mock).mock
        .calls[0];
      expect(update.$set.sections).toEqual(sections);
    });

    // The branch that is unreachable on the blog routes, because its schema
    // rejects "" before the handler ever sees it.
    it("unsets an optional field the admin cleared", async () => {
      await put({ seoTitle: "" });

      const [, update] = (LandingPage.findOneAndUpdate as jest.Mock).mock
        .calls[0];
      expect(update.$unset).toHaveProperty("seoTitle");
      expect(update.$set).not.toHaveProperty("seoTitle");
    });

    it("stamps publishedAt on the first publish only", async () => {
      (LandingPage.findOne as jest.Mock).mockReturnValue(
        chain({ path: "/x", publishedAt: new Date("2020-01-01") }),
      );

      await put({ status: "published" });

      const [, update] = (LandingPage.findOneAndUpdate as jest.Mock).mock
        .calls[0];
      expect(update.$set).not.toHaveProperty("publishedAt");
    });

    it("answers 404 when the page vanished between the read and the write", async () => {
      (LandingPage.findOneAndUpdate as jest.Mock).mockReturnValue(chain(null));

      expect((await put({ title: "x" })).status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("deletes and answers 200", async () => {
      expect((await del()).status).toBe(200);
    });

    it("answers 404 for a page that is not there", async () => {
      (LandingPage.findOneAndDelete as jest.Mock).mockResolvedValue(null);

      expect((await del()).status).toBe(404);
    });
  });
});
