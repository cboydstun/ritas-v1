/**
 * @jest-environment node
 */
import { GET } from "../route";
import { releaseStaleHolds } from "@/lib/inventory";

jest.mock("@/lib/inventory", () => ({
  releaseStaleHolds: jest.fn(),
  STALE_HOLD_MINUTES: 120,
}));

const mockRelease = releaseStaleHolds as jest.MockedFunction<
  typeof releaseStaleHolds
>;

const get = (authorization?: string) =>
  GET(
    new Request("http://localhost:3000/api/cron/release-holds", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("GET /api/cron/release-holds", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRelease.mockResolvedValue(3);
    process.env.CRON_SECRET = "s3cret";
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("releases stale holds for the configured secret", async () => {
    const response = await get("Bearer s3cret");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      released: 3,
      olderThanMinutes: 120,
    });
  });

  it.each([
    ["no header", undefined],
    ["the wrong secret", "Bearer nope"],
    ["a prefix of the secret", "Bearer s3cre"],
    ["the secret without the scheme", "s3cret"],
  ])("refuses %s", async (_label, authorization) => {
    const response = await get(authorization);

    expect(response.status).toBe(401);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  // Without a configured secret the endpoint stays closed rather than open.
  it("refuses to run when no secret is configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await get("Bearer s3cret");

    expect(response.status).toBe(503);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("answers 500 rather than throwing when the sweep fails", async () => {
    mockRelease.mockRejectedValue(new Error("mongo down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const response = await get("Bearer s3cret");

    expect(response.status).toBe(500);
  });
});
