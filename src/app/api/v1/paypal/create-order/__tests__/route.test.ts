/**
 * @jest-environment node
 */
import { POST } from "../route";
import { Rental } from "@/models/rental";
import { createBooking } from "@/lib/booking/createBooking";
import {
  PayPalError,
  createPayPalOrder,
  resetPayPalClientIdWarning,
} from "@/lib/paypal/client";
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
  // The mismatch warning fires once per process, so the latch has to come
  // back between cases the way the token cache does.
  const clientIdEnv = {
    server: process.env.PAYPAL_CLIENT_ID,
    public: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    paypalConfigured.mockReturnValue(true);
    mockCreateOrder.mockResolvedValue({ id: "ORDER-1", status: "CREATED" });
    jest.spyOn(console, "error").mockImplementation(() => {});
    resetPayPalClientIdWarning();
  });

  // Assigning `undefined` writes the string "undefined", which would leave a
  // truthy client id behind for every later case.
  const restoreEnv = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv("PAYPAL_CLIENT_ID", clientIdEnv.server);
    restoreEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", clientIdEnv.public);
  });

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
  // A PayPal failure used to log as `{ name: 'PayPalError' }` and nothing
  // else, so a plain 401 could only be identified by pulling the production
  // credentials and calling PayPal by hand.
  describe("diagnosing a PayPal failure", () => {
    it("logs the issue and debug id PayPal returned", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(
        new PayPalError("PayPal POST /v2/checkout/orders failed", {
          status: 422,
          issue: "AMOUNT_MISMATCH",
          debugId: "d3b07384d113edec",
        }),
      );

      await post({ rentalData: validRental() });

      expect(console.error).toHaveBeenCalledWith(
        "Error creating PayPal order:",
        expect.objectContaining({
          issue: "AMOUNT_MISMATCH",
          debugId: "d3b07384d113edec",
          status: 422,
        }),
      );
    });

    it("names a client id the browser and the server disagree about", async () => {
      process.env.PAYPAL_CLIENT_ID = "short";
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "a-real-eighty-character-id";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);

      await post({ rentalData: validRental() });

      expect(console.error).toHaveBeenCalledWith(
        "PAYPAL_CLIENT_ID_MISMATCH",
        expect.objectContaining({ serverIdLength: 5, publicIdLength: 26 }),
      );
    });

    it("stays quiet when the two client ids agree", async () => {
      process.env.PAYPAL_CLIENT_ID = "same-id";
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "same-id";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);

      await post({ rentalData: validRental() });

      expect(console.error).not.toHaveBeenCalledWith(
        "PAYPAL_CLIENT_ID_MISMATCH",
        expect.anything(),
      );
    });
  });

  // A credential PayPal refuses fails identically on every retry, so the
  // generic "please try again" was advice that could never come true. The
  // customer has a working invoice button; send them to it.
  describe("when PayPal refuses our credentials", () => {
    const authFailure = () =>
      new PayPalError("PayPal authentication failed", {
        status: 401,
        issue: "invalid_client",
        debugId: "deadbeefcafe",
      });

    it("degrades to the invoice path rather than asking for a retry", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(authFailure());

      const response = await post({ rentalData: validRental() });

      expect(response.status).toBe(503);
      const { message } = await response.json();
      expect(message).toMatch(/still book/i);
      expect(message).not.toMatch(/try again/i);
    });

    it("gives the operator a marker carrying the debug id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(authFailure());

      await post({ rentalData: validRental() });

      expect(console.error).toHaveBeenCalledWith(
        "PAYPAL_AUTH_FAILED",
        expect.objectContaining({
          status: 401,
          issue: "invalid_client",
          debugId: "deadbeefcafe",
        }),
      );
    });

    // The hold is written before PayPal is called either way, so the unit has
    // to come back whichever branch answers.
    it("still rolls back the hold it just inserted", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(authFailure());

      await post({ rentalData: validRental() });

      expect(Rental.deleteOne).toHaveBeenCalled();
    });

    // Narrow on purpose: a PayPal outage is transient and retrying is the
    // right advice for it.
    it("leaves a PayPal server error as a 502", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateBooking.mockResolvedValue(bookingSuccess() as any);
      mockCreateOrder.mockRejectedValue(
        new PayPalError("PayPal POST /v2/checkout/orders failed", {
          status: 500,
        }),
      );

      const response = await post({ rentalData: validRental() });

      expect(response.status).toBe(502);
      expect((await response.json()).message).toMatch(/try again/i);
    });
  });
});
