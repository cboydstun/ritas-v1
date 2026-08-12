/**
 * @jest-environment node
 */
import { getPublicSettingsSafe } from "@/lib/public-settings";
import { Settings } from "@/models/settings";
import dbConnect from "@/lib/mongodb";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/models/settings", () => ({
  Settings: jest.fn().mockImplementation(() => ({
    toObject: () => ({ fees: { deliveryFee: 20 } }),
  })),
}));

const mockConnect = dbConnect as jest.MockedFunction<typeof dbConnect>;

describe("getPublicSettingsSafe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (Settings as unknown as { findOne: jest.Mock }).findOne = jest
      .fn()
      .mockResolvedValue(null);
  });

  it("returns settings when the database is reachable", async () => {
    mockConnect.mockResolvedValue(undefined as never);

    await expect(getPublicSettingsSafe("Test")).resolves.toBeDefined();
  });

  // Every settings-reading page is prerendered, and CI builds against a
  // deliberately unreachable MONGODB_URI — an uncaught read here is a red
  // build that typecheck, lint and jest all report as green.
  it("degrades to defaults rather than throwing when Mongo is unreachable", async () => {
    mockConnect.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), {
        name: "MongooseServerSelectionError",
      }),
    );

    await expect(getPublicSettingsSafe("Test")).resolves.toEqual({});
  });

  it("logs the failure without leaking the connection string", async () => {
    mockConnect.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED mongodb://user:pw@host"), {
        name: "MongooseServerSelectionError",
      }),
    );

    await getPublicSettingsSafe("Pricing page");

    const logged = (console.error as jest.Mock).mock.calls[0].join(" ");
    expect(logged).toContain("Pricing page");
    expect(logged).not.toContain("mongodb://");
  });
});
