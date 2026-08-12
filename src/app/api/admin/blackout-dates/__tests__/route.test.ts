/**
 * @jest-environment node
 */
import { POST } from "../route";
import { PUT, DELETE } from "../[id]/route";
import { BlackoutDate } from "@/models/blackout-date";
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

const createdDocs: Record<string, unknown>[] = [];
jest.mock("@/models/blackout-date", () => ({
  // Only the model itself is stubbed. The module also re-exports
  // MODEL_RULE_MESSAGES (mapped onto 400s in every catch block) and
  // createLocalDate (which builds the stored instant); replacing the whole
  // module with a bare object made both undefined and turned every path
  // through them into a 500.
  ...jest.requireActual("@/models/blackout-date"),
  BlackoutDate: Object.assign(
    jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
      doc: Record<string, unknown>,
    ) {
      createdDocs.push(doc);
      this.save = jest.fn().mockResolvedValue({ _id: "new-id", ...doc });
    }),
    {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    },
  ),
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

const VALID_ID = "507f1f77bcf86cd799439011";

const futureDate = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const validBody = (overrides: Record<string, unknown> = {}) => ({
  startDate: futureDate(10),
  endDate: futureDate(12),
  type: "full_day",
  reason: "Maintenance",
  ...overrides,
});

const asRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/blackout-dates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const post = (body: unknown) =>
  POST(asRequest(body) as never as Parameters<typeof POST>[0]);

const put = (body: unknown, id = VALID_ID) =>
  PUT(asRequest(body) as never as Parameters<typeof PUT>[0], {
    params: Promise.resolve({ id }),
  });

const del = (id = VALID_ID) =>
  DELETE(
    new Request("http://localhost/x", {
      method: "DELETE",
    }) as never as Parameters<typeof DELETE>[0],
    { params: Promise.resolve({ id }) },
  );

const lastCreated = () => createdDocs[createdDocs.length - 1];

describe("admin blackout-date routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdDocs.length = 0;
    mockSession.mockResolvedValue({
      user: { role: "admin", name: "admin" },
    } as never);
    (BlackoutDate.findById as jest.Mock).mockResolvedValue({
      _id: VALID_ID,
      startDate: new Date(),
      type: "full_day",
    });
    (BlackoutDate.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      _id: VALID_ID,
    });
    (BlackoutDate.findByIdAndDelete as jest.Mock).mockResolvedValue({
      _id: VALID_ID,
    });
  });

  describe("auth", () => {
    it.each([
      ["POST", () => post(validBody())],
      ["PUT", () => put(validBody())],
      ["DELETE", () => del()],
    ])("%s rejects a caller who is not an admin", async (_m, call) => {
      mockSession.mockResolvedValue(null);

      expect((await call()).status).toBe(401);
    });

    it("PUT rejects a non-admin role even with a session", async () => {
      mockSession.mockResolvedValue({ user: { role: "viewer" } } as never);

      expect((await put(validBody())).status).toBe(401);
    });
  });

  describe("POST", () => {
    it("creates a full-day blackout from a valid body", async () => {
      const response = await post(validBody());

      expect(response.status).toBe(201);
      expect(lastCreated().type).toBe("full_day");
      expect(lastCreated().createdBy).toBe("admin");
    });

    // These rules were hand-rolled and duplicated across the two handlers,
    // free to drift apart; they now come from one shared zod schema.
    it.each([
      ["a missing startDate", validBody({ startDate: undefined })],
      ["a malformed startDate", validBody({ startDate: "06/15/2026" })],
      ["an impossible calendar date", validBody({ startDate: "2026-02-30" })],
      ["an unknown type", validBody({ type: "half_day" })],
      ["an inverted date range", validBody({ endDate: futureDate(5) })],
      [
        "a time_range with no times",
        validBody({ type: "time_range", startTime: undefined }),
      ],
      [
        "a malformed time",
        validBody({ type: "time_range", startTime: "9:00", endTime: "17:00" }),
      ],
      [
        "an inverted time range",
        validBody({ type: "time_range", startTime: "17:00", endTime: "09:00" }),
      ],
    ])("rejects %s with a 400", async (_label, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(createdDocs).toHaveLength(0);
    });

    it("accepts a well-formed time_range", async () => {
      const response = await post(
        validBody({ type: "time_range", startTime: "09:00", endTime: "17:00" }),
      );

      expect(response.status).toBe(201);
      expect(lastCreated().startTime).toBe("09:00");
      expect(lastCreated().endTime).toBe("17:00");
    });

    // `reason` used to be untyped and unbounded.
    it("rejects an over-long reason", async () => {
      const response = await post(validBody({ reason: "x".repeat(501) }));

      expect(response.status).toBe(400);
    });

    it("drops the times when the type is full_day", async () => {
      const response = await post(
        validBody({ startTime: "09:00", endTime: "17:00" }),
      );

      expect(response.status).toBe(201);
      expect(lastCreated().startTime).toBeUndefined();
      expect(lastCreated().endTime).toBeUndefined();
    });
  });

  describe("PUT", () => {
    it("updates a blackout date from a valid body", async () => {
      const response = await put(validBody());

      expect(response.status).toBe(200);
      expect(BlackoutDate.findByIdAndUpdate).toHaveBeenCalled();
    });

    it("rejects a malformed id before touching the database", async () => {
      const response = await put(validBody(), "not-an-object-id");

      expect(response.status).toBe(400);
      expect(BlackoutDate.findById).not.toHaveBeenCalled();
    });

    it("404s when the blackout date does not exist", async () => {
      (BlackoutDate.findById as jest.Mock).mockResolvedValue(null);

      expect((await put(validBody())).status).toBe(404);
    });

    it("applies the same shared validation as POST", async () => {
      const response = await put(validBody({ endDate: futureDate(5) }));

      expect(response.status).toBe(400);
      expect(BlackoutDate.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("deletes an existing blackout date", async () => {
      const response = await del();

      expect(response.status).toBe(200);
      expect(BlackoutDate.findByIdAndDelete).toHaveBeenCalledWith(VALID_ID);
    });

    it("rejects a malformed id", async () => {
      expect((await del("nope")).status).toBe(400);
      expect(BlackoutDate.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it("404s when the blackout date does not exist", async () => {
      (BlackoutDate.findById as jest.Mock).mockResolvedValue(null);

      expect((await del()).status).toBe(404);
    });
  });
});
