/**
 * @jest-environment node
 */
import { POST } from "../route";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { isMachineAvailable } from "@/lib/inventory";
import { sendBookingNotifications } from "@/lib/booking/notify";
import {
  ORDER_ALREADY_CAPTURED,
  PayPalError,
  capturePayPalOrder,
  getPayPalOrder,
} from "@/lib/paypal/client";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/rental", () => ({
  Rental: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));

jest.mock("@/models/settings", () => ({
  Settings: { findOne: jest.fn() },
}));

jest.mock("@/lib/inventory", () => ({
  ...jest.requireActual("@/lib/inventory"),
  isMachineAvailable: jest.fn(),
}));

jest.mock("@/lib/booking/notify", () => ({
  sendBookingNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/paypal/client", () => ({
  ...jest.requireActual("@/lib/paypal/client"),
  capturePayPalOrder: jest.fn(),
  getPayPalOrder: jest.fn(),
  paypalConfigured: jest.fn(() => true),
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

const mockCapture = capturePayPalOrder as jest.MockedFunction<
  typeof capturePayPalOrder
>;
const mockGetOrder = getPayPalOrder as jest.MockedFunction<
  typeof getPayPalOrder
>;
const mockAvailable = isMachineAvailable as jest.MockedFunction<
  typeof isMachineAvailable
>;
const { paypalConfigured } = jest.requireMock("@/lib/paypal/client") as {
  paypalConfigured: jest.Mock;
};

const post = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost:3000/api/v1/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** The unpaid `pending` hold the buyer is coming back to pay for. */
const heldRental = (over: Record<string, unknown> = {}) => ({
  _id: { toString: () => "rental-id" },
  bookingId: "BOOKID1234",
  status: "pending",
  price: 183.9,
  machineType: "double",
  capacity: 30,
  rentalDate: "2026-07-04",
  returnDate: "2026-07-05",
  selectedMixers: ["margarita"],
  selectedExtras: [],
  customer: { address: { zipCode: "78205" } },
  createdAt: new Date(),
  payment: { status: "pending", amount: 183.9 },
  ...over,
});

/** A PayPal order carrying one capture. */
const orderWithCapture = (
  over: { status?: string; value?: string; currency?: string } = {},
) => ({
  id: "ORDER-1",
  status: "COMPLETED",
  purchase_units: [
    {
      payments: {
        captures: [
          {
            id: "CAP1",
            status: over.status ?? "COMPLETED",
            amount: {
              currency_code: over.currency ?? "USD",
              value: over.value ?? "183.90",
            },
          },
        ],
      },
    },
  ],
});

/** What `findOneAndUpdate` gives back when this request won the claim. */
const wonUpdate = () => heldRental({ status: "confirmed" });

describe("POST /api/v1/paypal/capture-order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paypalConfigured.mockReturnValue(true);
    (Rental.findOne as jest.Mock).mockResolvedValue(heldRental());
    (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(wonUpdate());
    (Settings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        deliveryZones: { customFees: { "78205": 20 } },
      }),
    });
    mockAvailable.mockResolvedValue({ available: true });
    mockCapture.mockResolvedValue(orderWithCapture());
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe("the happy path", () => {
    it("confirms the booking and marks the payment completed", async () => {
      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        bookingId: "BOOKID1234",
      });

      const update = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(update.$set).toMatchObject({
        status: "confirmed",
        "payment.paypalTransactionId": "CAP1",
        "payment.status": "completed",
        "payment.amount": 183.9,
      });
    });

    it("sends the paid confirmation exactly once", async () => {
      await post({ orderId: "ORDER-1" });

      expect(sendBookingNotifications).toHaveBeenCalledTimes(1);
      expect(sendBookingNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "BOOKID1234",
          payment: { paid: true, transactionId: "CAP1", method: "paypal" },
        }),
      );
    });

    // The stored price is what the customer was actually charged; a settings
    // change between opening and capturing must not rewrite the receipt.
    it("prints the stored price as the email total", async () => {
      await post({ orderId: "ORDER-1" });

      const arg = (sendBookingNotifications as jest.Mock).mock.calls[0][0];
      expect(arg.totals.finalTotal).toBe(183.9);
    });

    // Writing `payment: {...}` wholesale would drop fields.
    it("claims the booking with dotted paths and no runValidators", async () => {
      await post({ orderId: "ORDER-1" });

      const [filter, , options] = (Rental.findOneAndUpdate as jest.Mock).mock
        .calls[0];
      expect(filter).toMatchObject({
        "payment.status": { $ne: "completed" },
      });
      expect(options).not.toHaveProperty("runValidators");
    });
  });

  describe("idempotency", () => {
    // A retry must not charge twice or email twice.
    it("returns the booking id without capturing when already paid", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(
        heldRental({
          status: "confirmed",
          payment: { status: "completed", amount: 183.9 },
        }),
      );

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        bookingId: "BOOKID1234",
      });
      expect(mockCapture).not.toHaveBeenCalled();
      expect(sendBookingNotifications).not.toHaveBeenCalled();
    });

    // Two concurrent approvals both read `pending`; only the write that
    // actually matched may notify.
    it("does not notify when it loses the claim race", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        bookingId: "BOOKID1234",
      });
      expect(sendBookingNotifications).not.toHaveBeenCalled();
    });

    // The expected answer to a retry, and the canonical "customer paid,
    // booking never confirmed" bug if treated as a failure.
    it("recovers from ORDER_ALREADY_CAPTURED by reading the order back", async () => {
      mockCapture.mockRejectedValue(
        new PayPalError("already", {
          status: 422,
          issue: ORDER_ALREADY_CAPTURED,
        }),
      );
      mockGetOrder.mockResolvedValue(orderWithCapture());

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      expect(mockGetOrder).toHaveBeenCalledWith("ORDER-1");
      expect(Rental.findOneAndUpdate).toHaveBeenCalled();
    });

    // A timed-out capture is an unknown, not a failure — never re-POST blind.
    it("resolves a timed-out capture with a read rather than a retry", async () => {
      const timeout = new Error("timed out");
      timeout.name = "TimeoutError";
      mockCapture.mockRejectedValue(timeout);
      mockGetOrder.mockResolvedValue(orderWithCapture());

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockGetOrder).toHaveBeenCalledTimes(1);
    });

    it("reports a genuine PayPal failure rather than swallowing it", async () => {
      mockCapture.mockRejectedValue(
        new PayPalError("boom", { status: 500, issue: "INTERNAL" }),
      );

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(502);
      expect(mockGetOrder).not.toHaveBeenCalled();
      expect(Rental.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("refusing before taking money", () => {
    it("404s for an order id nothing matches", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(null);

      const response = await post({ orderId: "ORDER-NOPE" });

      expect(response.status).toBe(404);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    // The reaper cancels abandoned holds; capturing against one takes money
    // for a unit already back on sale.
    it("refuses a cancelled hold without calling PayPal", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(
        heldRental({ status: "cancelled" }),
      );

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(409);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    // A buyer can approve at t+130 minutes, by which point someone else may
    // hold the unit.
    it("refuses an expired hold whose machine has since gone", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(
        heldRental({ createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }),
      );
      mockAvailable.mockResolvedValue({
        available: false,
        reason: "All double tank machines are booked",
      });

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(409);
      expect(mockCapture).not.toHaveBeenCalled();
      expect((await response.json()).message).toMatch(/booked/i);
    });

    it("captures an expired hold whose machine is still free", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(
        heldRental({ createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }),
      );

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      expect(mockAvailable).toHaveBeenCalledWith(
        "double",
        30,
        "2026-07-04",
        "2026-07-05",
        { excludeRentalId: "rental-id" },
      );
      expect(mockCapture).toHaveBeenCalled();
    });

    // A fresh hold is still counting toward inventory, so there is nothing to
    // re-check and no reason to pay for the query.
    it("does not re-check availability for a fresh hold", async () => {
      await post({ orderId: "ORDER-1" });

      expect(mockAvailable).not.toHaveBeenCalled();
    });

    it("503s when PayPal is not configured", async () => {
      paypalConfigured.mockReturnValue(false);

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(503);
      expect(Rental.findOne).not.toHaveBeenCalled();
    });

    it("400s on a body with no order id", async () => {
      const response = await post({});

      expect(response.status).toBe(400);
      expect(Rental.findOne).not.toHaveBeenCalled();
    });

    // The body is never a source of money.
    it("ignores an amount supplied by the caller", async () => {
      await post({ orderId: "ORDER-1", amount: "1.00" });

      const update = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(update.$set["payment.amount"]).toBe(183.9);
    });
  });

  describe("captures that are not a settled payment", () => {
    // Money is committed, so the hold must stop being reapable — but it is
    // not confirmed either.
    it("parks a PENDING capture as pending_payment and sends nothing", async () => {
      mockCapture.mockResolvedValue(orderWithCapture({ status: "PENDING" }));

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      const update = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(update.$set).toMatchObject({
        status: "pending_payment",
        "payment.status": "pending",
        "payment.paypalTransactionId": "CAP1",
      });
      expect(sendBookingNotifications).not.toHaveBeenCalled();
    });

    // The hold stays `pending` so the buyer can pick another funding source.
    it.each(["DECLINED", "FAILED"])(
      "leaves the hold alone on a %s capture",
      async (status) => {
        mockCapture.mockResolvedValue(orderWithCapture({ status }));

        const response = await post({ orderId: "ORDER-1" });

        expect(response.status).toBe(402);
        expect(Rental.findOneAndUpdate).not.toHaveBeenCalled();
      },
    );

    it("502s when PayPal returns an order carrying no capture", async () => {
      mockCapture.mockResolvedValue({ id: "ORDER-1", status: "CREATED" });

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(502);
      expect(Rental.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("amount verification", () => {
    // Refusing the customer after their money has moved is worse than an
    // admin reconciling it, so this answers 200 — but never confirms.
    it("does not confirm when the captured amount differs", async () => {
      mockCapture.mockResolvedValue(orderWithCapture({ value: "1.00" }));

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(200);
      const update = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(update.$set.status).toBe("pending_payment");
      expect(update.$set["payment.status"]).toBe("pending");
      expect(sendBookingNotifications).not.toHaveBeenCalled();
    });

    it("does not confirm when the currency differs", async () => {
      mockCapture.mockResolvedValue(orderWithCapture({ currency: "CAD" }));

      await post({ orderId: "ORDER-1" });

      const update = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(update.$set.status).toBe("pending_payment");
    });

    it("logs a mismatch with both figures for reconciliation", async () => {
      mockCapture.mockResolvedValue(orderWithCapture({ value: "1.00" }));

      await post({ orderId: "ORDER-1" });

      expect(console.error).toHaveBeenCalledWith(
        "PAYPAL_AMOUNT_MISMATCH",
        expect.objectContaining({
          bookingId: "BOOKID1234",
          expected: "183.90",
          captured: "1.00",
        }),
      );
    });

    it("compares against the stored price, formatted to two decimals", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(
        heldRental({ price: 100 }),
      );
      mockCapture.mockResolvedValue(orderWithCapture({ value: "100.00" }));

      await post({ orderId: "ORDER-1" });

      const update = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(update.$set.status).toBe("confirmed");
    });
  });

  describe("the orphan window", () => {
    // PayPal took the money and the write then threw. The marker is what
    // makes the case findable when no retry comes.
    it("logs PAYPAL_CAPTURE_ORPHANED when the write fails after a capture", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockRejectedValue(
        new Error("mongo down"),
      );

      const response = await post({ orderId: "ORDER-1" });

      expect(response.status).toBe(502);
      expect(console.error).toHaveBeenCalledWith(
        "PAYPAL_CAPTURE_ORPHANED",
        expect.objectContaining({ captureId: "CAP1" }),
      );
    });

    // Nothing was charged, so this must not read as an orphaned capture.
    it("does not log that marker for a failure before any capture", async () => {
      mockCapture.mockRejectedValue(
        new PayPalError("boom", { status: 500, issue: "INTERNAL" }),
      );

      await post({ orderId: "ORDER-1" });

      expect(console.error).not.toHaveBeenCalledWith(
        "PAYPAL_CAPTURE_ORPHANED",
        expect.anything(),
      );
    });
  });
});
