/**
 * @jest-environment node
 */
import { POST } from "../route";
import { Rental } from "@/models/rental";
import { createBooking } from "@/lib/booking/createBooking";
import { createPayPalOrder } from "@/lib/paypal/client";
import { sendBookingNotifications } from "@/lib/booking/notify";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/rental", () => ({
  Rental: { deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) },
}));

jest.mock("@/lib/booking/createBooking", () => ({
  createBooking: jest.fn(),
}));

jest.mock("@/lib/booking/notify", () => ({
  sendBookingNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/paypal/client", () => ({
  ...jest.requireActual("@/lib/paypal/client"),
  createPayPalOrder: jest.fn(),
  paypalConfigured: jest.fn(() => true),
}));

// Shared limiter, one process, many cases.
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

const mockCreateBooking = createBooking as jest.MockedFunction<
  typeof createBooking
>;
const mockCreateOrder = createPayPalOrder as jest.MockedFunction<
  typeof createPayPalOrder
>;
const { paypalConfigured } = jest.requireMock("@/lib/paypal/client") as {
  paypalConfigured: jest.Mock;
};

const futureDate = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const validRental = () => ({
  machineType: "double",
  selectedMixers: ["margarita"],
  selectedExtras: [],
  rentalDate: futureDate(10),
  rentalTime: "12:00",
  returnDate: futureDate(11),
  returnTime: "12:00",
  customer: {
    name: "Sam Rivera",
    email: "sam@example.com",
    phone: "(210) 555-0134",
    address: {
      street: "1 Alamo Plaza",
      city: "San Antonio",
      state: "TX",
      zipCode: "78205",
    },
  },
  notes: "",
});

const post = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost:3000/api/v1/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** A successful `createBooking`, with a savable document. */
const bookingSuccess = (over: Record<string, unknown> = {}) => {
  const rental: Record<string, unknown> = { price: 183.9 };
  rental.save = jest.fn().mockResolvedValue(rental);
  return {
    ok: true as const,
    rental,
    savedRental: { _id: { toString: () => "rental-id" } },
    rentalId: "rental-id",
    bookingId: "BOOKID1234",
    totals: { finalTotal: 183.9 },
    rates: { taxRate: 0.0825, processingRate: 0.03 },
    mixerLabel: (id: string) => id,
    resolvedMixers: ["margarita"],
    inserted: true,
    ...over,
  };
};

describe("POST /api/v1/paypal/create-order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paypalConfigured.mockReturnValue(true);
    mockCreateOrder.mockResolvedValue({ id: "ORDER-1", status: "CREATED" });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("opens an order for the server-side price and returns both ids", async () => {
    const booking = bookingSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateBooking.mockResolvedValue(booking as any);

    const response = await post({ rentalData: validRental() });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "ORDER-1",
      bookingId: "BOOKID1234",
    });
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountUsd: 183.9, bookingId: "BOOKID1234" }),
    );
  });

  // Only `pending` is reaped, so an abandoned payment window must write it.
  it("writes the hold as pending, never pending_payment", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateBooking.mockResolvedValue(bookingSuccess() as any);

    await post({ rentalData: validRental() });

    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("stores the PayPal order id on the booking", async () => {
    const booking = bookingSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateBooking.mockResolvedValue(booking as any);

    await post({ rentalData: validRental() });

    expect(booking.rental.paypalOrderId).toBe("ORDER-1");
    expect(booking.rental.save).toHaveBeenCalled();
  });

  // The confirmation email is the capture route's job. Sending it here would
  // tell a customer their booking is confirmed before they have paid.
  it("sends no notification", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateBooking.mockResolvedValue(bookingSuccess() as any);

    await post({ rentalData: validRental() });

    expect(sendBookingNotifications).not.toHaveBeenCalled();
  });

  it("passes a reused booking id through to createBooking", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateBooking.mockResolvedValue(bookingSuccess() as any);

    await post({ rentalData: validRental(), reuseBookingId: "HELD123" });

    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reuseBookingId: "HELD123" }),
    );
  });

  describe("when PayPal is unreachable", () => {
    // A hold PayPal never learned about is unreachable by capture and sits on
    // a unit until the reaper catches it two hours later.
    it("deletes a booking it just inserted", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(new Error("paypal down"));

      const response = await post({ rentalData: validRental() });

      expect(response.status).toBe(502);
      expect(Rental.deleteOne).toHaveBeenCalledWith({
        _id: { toString: expect.any(Function) },
      });
    });

    // A reused hold predates this request and is not ours to delete.
    it("leaves a reused hold alone", async () => {
      mockCreateBooking.mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bookingSuccess({ inserted: false }) as any,
      );
      mockCreateOrder.mockRejectedValue(new Error("paypal down"));

      await post({ rentalData: validRental(), reuseBookingId: "HELD123" });

      expect(Rental.deleteOne).not.toHaveBeenCalled();
    });

    it("still answers when the rollback itself fails", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(new Error("paypal down"));
      (Rental.deleteOne as jest.Mock).mockRejectedValueOnce(
        new Error("mongo down"),
      );

      const response = await post({ rentalData: validRental() });

      expect(response.status).toBe(502);
    });
  });

  describe("refusals", () => {
    // NEXT_PUBLIC_PAYPAL_CLIENT_ID is inlined at build time, so buttons can
    // render against a route with no credentials. The message has to send the
    // customer to the invoice button rather than leave them stuck.
    it("503s readably when PayPal is not configured", async () => {
      paypalConfigured.mockReturnValue(false);

      const response = await post({ rentalData: validRental() });

      expect(response.status).toBe(503);
      expect((await response.json()).message).toMatch(/still book/i);
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });

    it("passes a createBooking refusal straight through", async () => {
      mockCreateBooking.mockResolvedValue({
        ok: false,
        status: 409,
        message: "All double tank machines are booked",
      });

      const response = await post({ rentalData: validRental() });

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(
        "All double tank machines are booked",
      );
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("400s on a malformed body without touching PayPal", async () => {
      const response = await post({
        rentalData: { machineType: "hovercraft" },
      });

      expect(response.status).toBe(400);
      expect(mockCreateBooking).not.toHaveBeenCalled();
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });
  });
});
