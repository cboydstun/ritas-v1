/**
 * @jest-environment node
 */
import {
  formatDeliveryTime,
  pct,
  sendBookingNotifications,
  type BookingNotificationInput,
} from "../notify";
import type { OrderTotals } from "@/components/order/utils";

jest.mock("resend", () => {
  const send = jest.fn().mockResolvedValue({ data: {}, error: null });
  return {
    Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
    __send: send,
  };
});

jest.mock("twilio", () => {
  const create = jest.fn().mockResolvedValue({ sid: "sms" });
  return {
    __esModule: true,
    default: jest.fn(() => ({ messages: { create } })),
    __create: create,
  };
});

const resendMock = jest.requireMock("resend") as {
  Resend: jest.Mock;
  __send: jest.Mock;
};
const twilioMock = jest.requireMock("twilio") as {
  default: jest.Mock;
  __create: jest.Mock;
};

/** The HTML body of the most recent Resend send. */
const lastEmailHtml = (): string =>
  resendMock.__send.mock.calls.at(-1)?.[0]?.html ?? "";

/** The text body of the most recent Twilio send. */
const lastSmsBody = (): string =>
  twilioMock.__create.mock.calls.at(-1)?.[0]?.body ?? "";

const totals = (over: Partial<OrderTotals> = {}): OrderTotals =>
  ({
    basePrice: 124.95,
    mixerPrice: 19.95,
    deliveryFee: 20,
    deliveryBaseFee: 20,
    distanceSurcharge: 0,
    perDayRate: 144.9,
    rentalDays: 1,
    extrasTotal: 0,
    rentalSubtotal: 144.9,
    subtotal: 164.9,
    serviceDiscountAmount: 0,
    discountedSubtotal: 164.9,
    salesTax: 14.05,
    processingFee: 4.95,
    cashPrice: 178.5,
    finalTotal: 183.9,
    ...over,
  }) as OrderTotals;

const input = (
  over: Partial<BookingNotificationInput> = {},
): BookingNotificationInput => ({
  rental: {
    machineType: "double",
    capacity: 30,
    rentalDate: "2026-07-04",
    rentalTime: "14:00",
    returnDate: "2026-07-05",
    returnTime: "ANY",
    selectedExtras: [],
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
  },
  bookingId: "BOOKID1234",
  totals: totals(),
  rates: { taxRate: 0.0825, processingRate: 0.03 },
  mixerLabel: (id) => `Label ${id}`,
  resolvedMixers: ["margarita", "pina-colada"],
  payment: { paid: false },
  ...over,
});

const ORIGINAL_ENV = process.env;

describe("sendBookingNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      TWILIO_ACCOUNT_SID: "sid",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_PHONE_NUMBER: "+15125550000",
      USER_PHONE_NUMBER: "+15125550001",
      RESEND_API_KEY: "re_test",
    };
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  describe("paid vs unpaid copy", () => {
    // Telling a customer who has just paid that an invoice is coming is the
    // one thing this email must not do, and telling the operator to invoice
    // them is how a paid booking gets billed twice.
    it("promises an invoice when the booking was not paid", async () => {
      await sendBookingNotifications(input());

      expect(lastEmailHtml()).toContain("we will send you an invoice");
      expect(lastEmailHtml()).not.toContain("Paid in Full");
      expect(lastSmsBody()).toContain("INVOICE CUSTOMER FOR PAYMENT");
      expect(lastSmsBody()).toContain("NEW BOOKING - PAYMENT PENDING");
    });

    it("confirms payment and names the transaction when it was paid", async () => {
      await sendBookingNotifications(
        input({
          payment: { paid: true, transactionId: "CAP123", method: "paypal" },
        }),
      );

      expect(lastEmailHtml()).toContain("Paid in Full");
      expect(lastEmailHtml()).toContain("via PayPal");
      expect(lastEmailHtml()).not.toContain("we will send you an invoice");
      expect(lastEmailHtml()).not.toContain("No deposit is required");

      expect(lastSmsBody()).toContain("NEW BOOKING - PAID");
      expect(lastSmsBody()).toContain("PAID IN FULL VIA PAYPAL");
      expect(lastSmsBody()).toContain("CAP123");
      expect(lastSmsBody()).not.toContain("INVOICE CUSTOMER");
    });
  });

  describe("email body", () => {
    it("renders one tank row per tank, naming the mixer in each", async () => {
      await sendBookingNotifications(input());

      expect(lastEmailHtml()).toContain("Tank 1 — Label margarita");
      expect(lastEmailHtml()).toContain("Tank 2 — Label pina-colada");
      expect(lastEmailHtml()).not.toContain("Tank 3");
    });

    it("labels a single-tank machine's only tank without a number", async () => {
      await sendBookingNotifications(
        input({
          rental: { ...input().rental, machineType: "single", capacity: 15 },
          resolvedMixers: ["margarita"],
        }),
      );

      expect(lastEmailHtml()).toContain("Your Tank — Label margarita");
      expect(lastEmailHtml()).not.toContain("Tank 2");
    });

    it("renders three tanks for a triple", async () => {
      await sendBookingNotifications(
        input({
          rental: { ...input().rental, machineType: "triple", capacity: 45 },
          resolvedMixers: ["a", "b", "c"],
        }),
      );

      expect(lastEmailHtml()).toContain("Tank 3 — Label c");
    });

    it("says so when a tank has no mixer", async () => {
      await sendBookingNotifications(input({ resolvedMixers: ["margarita"] }));

      expect(lastEmailHtml()).toContain("Tank 2 — No Mixer Selected");
      expect(lastEmailHtml()).toContain(
        "You will be providing your own mixer and water",
      );
    });

    it("tells a customer with no mixers at all to bring their own", async () => {
      await sendBookingNotifications(
        input({ resolvedMixers: [], totals: totals({ mixerPrice: 0 }) }),
      );

      expect(lastEmailHtml()).toContain("None — Bring your own mixer");
      expect(lastSmsBody()).toContain("Mixers: None");
    });

    it("omits the mixer line from the breakdown when nothing was charged", async () => {
      await sendBookingNotifications(
        input({ totals: totals({ mixerPrice: 0 }), resolvedMixers: [] }),
      );

      expect(lastEmailHtml()).not.toContain("Mixer:");
      expect(lastEmailHtml()).not.toContain("Mixers:</td>");
    });

    it("lists party extras with their quantity when there are any", async () => {
      await sendBookingNotifications(
        input({
          rental: {
            ...input().rental,
            selectedExtras: [
              { name: "Tables & Chairs", quantity: 2 },
              { name: "Cups", quantity: 1 },
            ],
          },
          totals: totals({ extrasTotal: 45 }),
        }),
      );

      expect(lastEmailHtml()).toContain("Tables &amp; Chairs (2x)");
      // Quantity 1 is implicit and must not be rendered.
      expect(lastEmailHtml()).toContain("Cups</li>");
      expect(lastEmailHtml()).toContain("Party Extras:");
    });

    it("pluralises the rate line only for a multi-day rental", async () => {
      await sendBookingNotifications(input());
      expect(lastEmailHtml()).toContain("Rate × 1 day:");

      await sendBookingNotifications(
        input({ totals: totals({ rentalDays: 3 }) }),
      );
      expect(lastEmailHtml()).toContain("Rate × 3 days:");
    });

    // Extra names come from buildExtrasCatalog, which composes them from
    // admin-controlled Settings.mixers[*].label — not a server constant.
    it("escapes customer- and admin-supplied values", async () => {
      await sendBookingNotifications(
        input({
          rental: {
            ...input().rental,
            customer: {
              ...input().rental.customer,
              name: '<script>alert("x")</script>',
            },
            selectedExtras: [{ name: "<img onerror=1>", quantity: 1 }],
          },
        }),
      );

      expect(lastEmailHtml()).not.toContain("<script>");
      expect(lastEmailHtml()).toContain("&lt;script&gt;");
      expect(lastEmailHtml()).toContain("&lt;img onerror=1&gt;");
    });

    it("shows the rates it was given rather than the defaults", async () => {
      await sendBookingNotifications(
        input({ rates: { taxRate: 0.07, processingRate: 0.025 } }),
      );

      expect(lastEmailHtml()).toContain("Sales Tax (7%)");
      expect(lastEmailHtml()).toContain("Processing Fee (2.5%)");
    });
  });

  describe("failure is never fatal", () => {
    // The rental is already committed when this runs, so an escape here would
    // tell a customer their booking failed when it did not.
    it("resolves when Resend rejects", async () => {
      resendMock.__send.mockRejectedValueOnce(new Error("resend down"));

      await expect(sendBookingNotifications(input())).resolves.toBeUndefined();
    });

    // The Resend constructor throws synchronously with no API key.
    it("resolves when the Resend constructor throws", async () => {
      resendMock.Resend.mockImplementationOnce(() => {
        throw new Error("missing key");
      });

      await expect(sendBookingNotifications(input())).resolves.toBeUndefined();
    });

    it("resolves when Twilio rejects", async () => {
      twilioMock.__create.mockRejectedValueOnce(new Error("twilio down"));

      await expect(sendBookingNotifications(input())).resolves.toBeUndefined();
    });

    // twilio() throws synchronously on a malformed SID.
    it("resolves when the Twilio constructor throws", async () => {
      twilioMock.default.mockImplementationOnce(() => {
        throw new Error("bad sid");
      });

      await expect(sendBookingNotifications(input())).resolves.toBeUndefined();
      // The email still goes out — the two channels are independent.
      expect(resendMock.__send).toHaveBeenCalled();
    });

    it("skips SMS entirely when Twilio is not configured", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;

      await sendBookingNotifications(input());

      expect(twilioMock.__create).not.toHaveBeenCalled();
      expect(resendMock.__send).toHaveBeenCalled();
    });
  });
});

describe("formatDeliveryTime", () => {
  // The picker defaults to the "ANY" sentinel, which the old formatter fed to
  // parseInt and rendered as "12:undefined AM" in every operator SMS.
  it.each(["ANY", ""])("renders %p as Any Time", (value) => {
    expect(formatDeliveryTime(value)).toBe("Any Time");
  });

  it.each([
    ["14:00", "2:00 PM"],
    ["00:30", "12:30 AM"],
    ["12:00", "12:00 PM"],
    ["09:15", "9:15 AM"],
    ["23:59", "11:59 PM"],
  ])("renders %s as %s", (input24, expected) => {
    expect(formatDeliveryTime(input24)).toBe(expected);
  });

  it.each(["garbage", "25", "::"])("falls back to Any Time for %p", (value) => {
    expect(formatDeliveryTime(value)).toBe("Any Time");
  });
});

describe("pct", () => {
  it.each([
    [0.0825, "8.25%"],
    [0.03, "3%"],
    [0, "0%"],
    [0.070125, "7.0125%"],
  ])("renders %p as %s", (rate, expected) => {
    expect(pct(rate)).toBe(expected);
  });
});
