/**
 * @jest-environment node
 */
import { POST } from "../route";

// Mock MongoDB connection
jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

// Mock Thumbprint model — use jest.fn() inside factory to avoid hoisting issues
jest.mock("@/models/thumbprint", () => ({
  Thumbprint: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

// Typed references resolved after mock registration
import { Thumbprint } from "@/models/thumbprint";
const mockFindOne = Thumbprint.findOne as jest.Mock;
const mockFindOneAndUpdate = Thumbprint.findOneAndUpdate as jest.Mock;

// Mock next/headers
jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue("Mozilla/5.0 (Macintosh)"),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validComponents = {
  userAgent: "Mozilla/5.0",
  language: "en-US",
  platform: "MacIntel",
};

function makeRequest(body: object) {
  return new Request("http://localhost/api/v1/analytics/fingerprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function existingVisitor(
  overrides: Partial<{ completedSteps: string[] }> = {},
) {
  return {
    fingerprintHash: "hash-abc",
    device: { type: "desktop" },
    funnelData: {
      completedSteps: overrides.completedSteps ?? [],
    },
  };
}

describe("POST /api/v1/analytics/fingerprint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOneAndUpdate.mockResolvedValue({});
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when fingerprintHash is missing", async () => {
      mockFindOne.mockResolvedValue(null);
      const req = makeRequest({ components: validComponents });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/fingerprintHash/);
    });

    it("returns 400 when components is missing", async () => {
      mockFindOne.mockResolvedValue(null);
      const req = makeRequest({ fingerprintHash: "hash-abc" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/components/);
    });
  });

  // -------------------------------------------------------------------------
  // Step extraction from page path
  // -------------------------------------------------------------------------

  describe("step name extraction", () => {
    it('extracts "date" from /order/date page', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/order/date",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["funnelData.entryStep"]).toBe("date");
      expect(updateDoc.$set["funnelData.exitStep"]).toBe("date");
    });

    it('extracts "machine" from /order/machine page', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/order/machine",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["funnelData.entryStep"]).toBe("machine");
    });

    it("does not set funnel fields for non-order pages", async () => {
      mockFindOne.mockResolvedValue(null);
      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["funnelData.entryStep"]).toBeUndefined();
      expect(updateDoc.$set["funnelData.exitStep"]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Conversion detection — the core alignment fix
  // -------------------------------------------------------------------------

  describe("conversion detection", () => {
    it('marks conversion when step is "review" and visitor has 4 completed steps', async () => {
      // Visitor has completed date, machine, details, extras (4 steps)
      mockFindOne.mockResolvedValue(
        existingVisitor({
          completedSteps: ["date", "machine", "details", "extras"],
        }),
      );

      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/order/review",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["conversion.hasConverted"]).toBe(true);
      expect(updateDoc.$set["conversion.conversionType"]).toBe(
        "order_completed",
      );
    });

    it('does NOT mark conversion when step is "review" but fewer than 4 prior steps completed', async () => {
      // Only 2 steps completed — user skipped ahead somehow
      mockFindOne.mockResolvedValue(
        existingVisitor({ completedSteps: ["date", "machine"] }),
      );

      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/order/review",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["conversion.hasConverted"]).toBeUndefined();
    });

    it('does NOT mark conversion for the old "payment" step (no longer exists)', async () => {
      // Even with 4 completed steps, "payment" is no longer the conversion trigger
      mockFindOne.mockResolvedValue(
        existingVisitor({
          completedSteps: ["date", "machine", "details", "extras"],
        }),
      );

      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/order/payment",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["conversion.hasConverted"]).toBeUndefined();
    });

    it('does NOT mark conversion for intermediate steps (e.g. "extras") even with 4 prior steps', async () => {
      mockFindOne.mockResolvedValue(
        existingVisitor({
          completedSteps: ["date", "machine", "details", "extras"],
        }),
      );

      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/order/extras",
      });
      await POST(req);

      const updateCall = mockFindOneAndUpdate.mock.calls[0];
      const updateDoc = updateCall[1];
      expect(updateDoc.$set["conversion.hasConverted"]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // New vs returning visitor
  // -------------------------------------------------------------------------

  describe("new visitor", () => {
    it("returns isNewVisitor: true for first-time visitors", async () => {
      mockFindOne.mockResolvedValue(null);
      const req = makeRequest({
        fingerprintHash: "hash-new",
        components: validComponents,
        page: "/order/date",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isNewVisitor).toBe(true);
    });
  });

  describe("returning visitor", () => {
    it("returns isNewVisitor: false for returning visitors", async () => {
      mockFindOne.mockResolvedValue(existingVisitor());
      const req = makeRequest({
        fingerprintHash: "hash-abc",
        components: validComponents,
        page: "/",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isNewVisitor).toBe(false);
    });
  });
});
