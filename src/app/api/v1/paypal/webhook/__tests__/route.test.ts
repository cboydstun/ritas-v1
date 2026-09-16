/**
 * @jest-environment node
 */
import { POST } from "../route";
import { Rental } from "@/models/rental";
import { verifyWebhookSignature } from "@/lib/paypal/client";
import { PayPalError } from "@/lib/paypal/client";
import { capturePayPalBooking } from "@/lib/booking/capturePayPalBooking";
import {
  sendOperatorSms,
  sendPaymentFailedNotification,
} from "@/lib/booking/notify";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/rental", () => ({
  Rental: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));

jest.mock("@/lib/booking/capturePayPalBooking", () => ({
  capturePayPalBooking: jest.fn(),
  settleCapturedBooking: jest.fn(),
}));

jest.mock("@/lib/booking/notify", () => ({
  sendPaymentFailedNotification: jest.fn().mockResolvedValue(undefined),
  sendOperatorSms: jest.fn(() => null),
  settleOperatorSms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/paypal/client", () => ({
  ...jest.requireActual("@/lib/paypal/client"),
  verifyWebhookSignature: jest.fn(),
  paypalWebhookConfigured: jest.fn(() => true),
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

const mockVerify = verifyWebhookSignature as jest.MockedFunction<
  typeof verifyWebhookSignature
>;
const mockCapture = capturePayPalBooking as jest.MockedFunction<
  typeof capturePayPalBooking
>;
const { paypalWebhookConfigured } = jest.requireMock("@/lib/paypal/client") as {
  paypalWebhookConfigured: jest.Mock;
};

const post = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost:3000/api/v1/paypal/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** A capture event, in the shape PayPal actually sends one. */
const captureEvent = (type: string, over: Record<string, unknown> = {}) => ({
  id: "WH-1",
  event_type: type,
  resource: {
    id: "CAP1",
    status: "COMPLETED",
    amount: { value: "183.90", currency_code: "USD" },
    supplementary_data: { related_ids: { order_id: "ORDER-1" } },
    ...over,
  },
});

const heldRental = (over: Record<string, unknown> = {}) => ({
  _id: { toString: () => "rental-id" },
  bookingId: "BOOKID1234",
  status: "pending_payment",
  price: 183.9,
  machineType: "double",
  rentalDate: "2026-07-04",
  rentalTime: "12:00",
  payment: { status: "pending", amount: 183.9 },
  ...over,
});

describe("POST /api/v1/paypal/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    paypalWebhookConfigured.mockReturnValue(true);
    mockVerify.mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  describe("authentication", () => {
    // The route is public and PayPal carries no secret of ours, so this check
    // is the whole of its authentication.
    it("refuses an unverified event without touching anything", async () => {
      mockVerify.mockResolvedValue(false);

      const response = await post(captureEvent("PAYMENT.CAPTURE.COMPLETED"));

      expect(response.status).toBe(401);
      expect(Rental.findOne).not.toHaveBeenCalled();
      expect(Rental.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    // Not knowing whether an event is genuine is a different answer from
    // knowing it is not. Dropping it would discard a real paid-order
    // notification during a credential blip.
    it("asks PayPal to retry when verification itself fails", async () => {
      mockVerify.mockRejectedValue(
        new PayPalError("nope", { status: 401, issue: "invalid_client" }),
      );

      const response = await post(captureEvent("PAYMENT.CAPTURE.COMPLETED"));

      expect(response.status).toBe(503);
      expect(Rental.findOne).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "PAYPAL_WEBHOOK_VERIFY_FAILED",
        expect.objectContaining({ issue: "invalid_client" }),
      );
    });

    it("verifies before reading anything, even for a known event type", async () => {
      mockVerify.mockResolvedValue(false);

      await post(captureEvent("CHECKOUT.ORDER.APPROVED"));

      expect(mockVerify).toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("503s when the webhook id is not configured", async () => {
      paypalWebhookConfigured.mockReturnValue(false);

      const response = await post(captureEvent("PAYMENT.CAPTURE.COMPLETED"));

      expect(response.status).toBe(503);
      expect(mockVerify).not.toHaveBeenCalled();
    });
  });

  describe("event dispatch", () => {
    // 200, not 4xx: PayPal retries a non-2xx for days, and a type we will
    // never handle is not a failure.
    it("answers 200 and does nothing for an unhandled type", async () => {
      const response = await post(captureEvent("PAYMENT.CAPTURE.PENDING"));

      expect(response.status).toBe(200);
      expect(Rental.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe("CHECKOUT.ORDER.APPROVED", () => {
    // The gap this whole route exists for: the buyer approved and their
    // browser never came back.
    it("captures the order the browser abandoned", async () => {
      mockCapture.mockResolvedValue({
        ok: true,
        bookingId: "BOOKID1234",
        settled: true,
        amount: 183.9,
      });

      const response = await post({
        id: "WH-1",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: "ORDER-1" },
      });

      expect(mockCapture).toHaveBeenCalledWith("ORDER-1");
      await expect(response.json()).resolves.toEqual({
        bookingId: "BOOKID1234",
      });
    });

    // The refusal that matters: capturing here would take money for a unit
    // already sold to someone else.
    it("does not capture when the pre-flight refuses", async () => {
      mockCapture.mockResolvedValue({
        ok: false,
        status: 409,
        message: "This machine was booked while your payment was open.",
      });

      const response = await post({
        id: "WH-1",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: "ORDER-1" },
      });

      // 200 so PayPal stops retrying a decision that will not change.
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ handled: false });
    });
  });

  describe("PAYMENT.CAPTURE.COMPLETED", () => {
    it("does nothing for an order that matches no booking", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(null);

      const response = await post(captureEvent("PAYMENT.CAPTURE.COMPLETED"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ handled: false });
    });

    // Redelivery is normal, not exceptional.
    it("is inert on a booking already settled", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(
        heldRental({ status: "confirmed", payment: { status: "completed" } }),
      );

      const response = await post(captureEvent("PAYMENT.CAPTURE.COMPLETED"));

      await expect(response.json()).resolves.toEqual({
        bookingId: "BOOKID1234",
      });
      expect(Rental.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("PAYMENT.CAPTURE.DENIED", () => {
    // The customer is holding an email saying the payment is clearing.
    it("frees the unit and tells the customer", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(heldRental());

      const response = await post(
        captureEvent("PAYMENT.CAPTURE.DENIED", { status: "DENIED" }),
      );

      const [filter, update] = (Rental.findOneAndUpdate as jest.Mock).mock
        .calls[0];
      expect(filter.paypalOrderId).toBe("ORDER-1");
      expect(update.$set).toMatchObject({
        status: "cancelled",
        "payment.status": "failed",
      });
      expect(sendPaymentFailedNotification).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: "BOOKID1234" }),
      );
      expect(response.status).toBe(200);
    });

    // The filter is the dedupe: a redelivery matches nothing.
    it("emails nobody twice when the event is redelivered", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await post(captureEvent("PAYMENT.CAPTURE.DENIED", { status: "DENIED" }));

      expect(sendPaymentFailedNotification).not.toHaveBeenCalled();
    });

    it("never touches a payment that already completed", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await post(captureEvent("PAYMENT.CAPTURE.DENIED", { status: "DENIED" }));

      const [filter] = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0];
      expect(filter["payment.status"].$nin).toContain("completed");
    });
  });

  describe("PAYMENT.CAPTURE.REFUNDED", () => {
    // Recorded, never acted on: a partial refund or a goodwill gesture must
    // not put the machine back on sale behind the operator's back.
    it("records the refund and leaves the rental status alone", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(
        heldRental({ status: "confirmed" }),
      );

      const response = await post(captureEvent("PAYMENT.CAPTURE.REFUNDED"));

      const [, update] = (Rental.findOneAndUpdate as jest.Mock).mock.calls[0];
      expect(update.$set["payment.status"]).toBe("refunded");
      expect(update.$set.status).toBeUndefined();
      expect(sendOperatorSms).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("is inert on redelivery", async () => {
      (Rental.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await post(captureEvent("PAYMENT.CAPTURE.REFUNDED"));

      expect(sendOperatorSms).not.toHaveBeenCalled();
    });
  });

  // PayPal retries a 5xx, and both capture paths are idempotent, so a
  // redelivery after a partial failure heals rather than double-charges.
  it("asks for a retry when handling throws", async () => {
    mockCapture.mockRejectedValue(new Error("mongo down"));

    const response = await post({
      id: "WH-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "ORDER-1" },
    });

    expect(response.status).toBe(500);
  });
});
