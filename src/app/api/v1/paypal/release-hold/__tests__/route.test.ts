/**
 * @jest-environment node
 */
import { POST } from "../route";
import { Rental } from "@/models/rental";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/rental", () => ({
  Rental: { deleteOne: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    rateLimit: jest.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
  };
});

const post = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost:3000/api/v1/paypal/release-hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/v1/paypal/release-hold", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Rental.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("releases the hold and says so", async () => {
    const response = await post({ orderId: "ORDER-1" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ released: true });
  });

  /**
   * The whole safety of this endpoint. It is unauthenticated, so the query —
   * not a caller's claim — is what stops it deleting a booking that is not an
   * abandoned hold.
   */
  it("can only ever match an unpaid, pending hold", async () => {
    await post({ orderId: "ORDER-1" });

    expect(Rental.deleteOne).toHaveBeenCalledWith({
      paypalOrderId: "ORDER-1",
      status: "pending",
      "payment.status": { $ne: "completed" },
    });
  });

  it("reports nothing released when the filter matches no document", async () => {
    (Rental.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

    const response = await post({ orderId: "ORDER-1" });

    await expect(response.json()).resolves.toEqual({ released: false });
  });

  // The caller fires this after the buyer has already walked away and has
  // nothing useful to do with a failure; the reaper is the real guarantee.
  it("answers 200 even when the delete throws", async () => {
    (Rental.deleteOne as jest.Mock).mockRejectedValue(new Error("mongo down"));

    const response = await post({ orderId: "ORDER-1" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ released: false });
  });

  it("400s without an order id rather than deleting broadly", async () => {
    const response = await post({});

    expect(response.status).toBe(400);
    expect(Rental.deleteOne).not.toHaveBeenCalled();
  });

  // A rental id would make this a way to cancel a stranger's booking; the
  // PayPal order id is unguessable, and nothing else is accepted.
  it("ignores a rental id supplied alongside the order id", async () => {
    await post({ orderId: "ORDER-1", rentalId: "someone-elses" });

    expect(Rental.deleteOne).toHaveBeenCalledWith(
      expect.not.objectContaining({ _id: expect.anything() }),
    );
  });

  it.each(["../../etc", "OR 1=1", "a b"])(
    "rejects the malformed order id %p",
    async (orderId) => {
      const response = await post({ orderId });

      expect(response.status).toBe(400);
      expect(Rental.deleteOne).not.toHaveBeenCalled();
    },
  );
});
