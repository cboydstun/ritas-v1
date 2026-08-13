/**
 * @jest-environment node
 */
import { POST } from "../route";
import { LandingPage } from "@/models/landingPage";
import { SERVICE_AREAS } from "@/lib/service-areas";
import { getServerSession } from "next-auth/next";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

jest.mock("@/models/landingPage", () => ({
  LandingPage: { find: jest.fn(), bulkWrite: jest.fn() },
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

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

const seed = () =>
  POST(
    new Request("http://localhost/api/admin/service-area-seed", {
      method: "POST",
    }) as never as Parameters<typeof POST>[0],
  );

describe("service-area seed route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({
      user: { role: "admin", name: "admin" },
    } as never);
    (LandingPage.find as jest.Mock).mockReturnValue(chain([]));
    (LandingPage.bulkWrite as jest.Mock).mockResolvedValue({});
  });

  it("rejects a non-admin", async () => {
    mockSession.mockResolvedValue({ user: { role: "customer" } } as never);

    expect((await seed()).status).toBe(401);
    expect(LandingPage.bulkWrite).not.toHaveBeenCalled();
  });

  it("upserts one document per service area", async () => {
    const response = await seed();
    const [operations] = (LandingPage.bulkWrite as jest.Mock).mock.calls[0];

    expect(response.status).toBe(200);
    expect(operations).toHaveLength(SERVICE_AREAS.length);
    expect((await response.json()).created).toHaveLength(SERVICE_AREAS.length);
  });

  /**
   * The property that makes the button safe to press twice, safe after a
   * partial failure, and safe once an admin has edited a seeded page. A `$set`
   * here would silently revert their work.
   */
  it("writes only on insert, so a re-run cannot overwrite an admin's edits", async () => {
    await seed();
    const [operations] = (LandingPage.bulkWrite as jest.Mock).mock.calls[0];

    for (const operation of operations) {
      expect(operation.updateOne.update).toHaveProperty("$setOnInsert");
      expect(operation.updateOne.update).not.toHaveProperty("$set");
      expect(operation.updateOne.upsert).toBe(true);
    }
  });

  it("keys each upsert on the page path", async () => {
    await seed();
    const [operations] = (LandingPage.bulkWrite as jest.Mock).mock.calls[0];

    expect(operations[0].updateOne.filter).toEqual({
      path: `/service-area/${SERVICE_AREAS[0].slug}`,
    });
  });

  it("reports which pages already existed", async () => {
    (LandingPage.find as jest.Mock).mockReturnValue(
      chain([{ path: `/service-area/${SERVICE_AREAS[0].slug}` }]),
    );

    const body = await (await seed()).json();

    expect(body.skipped).toEqual([`/service-area/${SERVICE_AREAS[0].slug}`]);
    expect(body.created).toHaveLength(SERVICE_AREAS.length - 1);
  });

  it("revalidates only the pages it actually created", async () => {
    const { revalidatePath } = jest.requireMock("next/cache");
    (LandingPage.find as jest.Mock).mockReturnValue(
      chain(
        SERVICE_AREAS.map((area) => ({ path: `/service-area/${area.slug}` })),
      ),
    );

    await seed();

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 500 rather than writing when the database is unreachable", async () => {
    (LandingPage.bulkWrite as jest.Mock).mockRejectedValue(new Error("down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect((await seed()).status).toBe(500);
  });
});
