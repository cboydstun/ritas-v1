/**
 * @jest-environment node
 */
import { createBooking } from "../createBooking";
import { Rental } from "@/models/rental";
import { isMachineAvailable, releaseStaleHolds } from "@/lib/inventory";
import { Settings } from "@/models/settings";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/inventory", () => ({
  isMachineAvailable: jest.fn(),
  releaseStaleHolds: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/models/settings", () => ({
  Settings: { findOne: jest.fn() },
}));

// The pipeline builds a document and calls `.save()` on it, so the
// constructor is what has to be observable — that is where the server-side
// price lands.
const savedDocs: Record<string, unknown>[] = [];
jest.mock("@/models/rental", () => ({
  Rental: Object.assign(
    jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
      doc: Record<string, unknown>,
    ) {
      Object.assign(this, doc);
      savedDocs.push(doc);
      this.save = jest.fn().mockResolvedValue({
        ...doc,
        _id: { toString: () => "rental-id" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
      });
    }),
    {
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      findOne: jest.fn(),
    },
  ),
}));

jest.mock("nanoid", () => ({ nanoid: () => "bookid1234" }));

const mockAvailable = isMachineAvailable as jest.MockedFunction<
  typeof isMachineAvailable
>;

const futureDate = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const validRental = (overrides: Record<string, unknown> = {}) => ({
  machineType: "double",
  selectedMixers: ["margarita", "pina-colada"],
  selectedExtras: [],
  rentalDate: futureDate(10),
  rentalTime: "12:00",
  rentalTimePreference: "specific",
  returnDate: futureDate(11),
  returnTime: "12:00",
  returnTimePreference: "specific",
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
  ...overrides,
});

/**
 * `deliveryZones` is not optional decoration: `customFees` is both the price
 * list and the service area, so a fixture without it makes every ZIP
 * unserviced and every case fails at the gate.
 */
const settingsFixture = (overrides: Record<string, unknown> = {}) => ({
  lean: jest.fn().mockResolvedValue({
    deliveryZones: {
      customFees: { "78205": 20 },
      insideZips: ["78205"],
      outsideZips: [],
      tierMinimums: { free: 0, low: 0, standard: 0, high: 0, premium: 0 },
    },
    ...overrides,
  }),
});

const lastSaved = () => savedDocs[savedDocs.length - 1];

describe("createBooking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    savedDocs.length = 0;
    mockAvailable.mockResolvedValue({ available: true });
    (Settings.findOne as jest.Mock).mockReturnValue(settingsFixture());
    (Rental.findOne as jest.Mock).mockResolvedValue(null);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  // The cron is the primary sweeper; this call keeps the booking path correct
  // even on a deployment where the schedule was never configured.
  it("sweeps stale holds before checking availability", async () => {
    await createBooking(validRental(), { status: "pending" });

    expect(releaseStaleHolds).toHaveBeenCalled();
    expect(
      (releaseStaleHolds as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(mockAvailable.mock.invocationCallOrder[0]);
  });

  describe("the status it writes", () => {
    // Only `pending` is ever reaped. The PayPal hold must expire when a buyer
    // walks away from the payment window; a submitted booking must not.
    it("writes pending_payment for the invoice path", async () => {
      const result = await createBooking(validRental(), {
        status: "pending_payment",
      });

      expect(result.ok).toBe(true);
      expect(lastSaved().status).toBe("pending_payment");
    });

    it("writes pending for the PayPal hold", async () => {
      const result = await createBooking(validRental(), { status: "pending" });

      expect(result.ok).toBe(true);
      expect(lastSaved().status).toBe("pending");
    });
  });

  describe("money and identity are server-derived", () => {
    it("ignores a price supplied by the caller", async () => {
      await createBooking(validRental({ price: 1 }), {
        status: "pending_payment",
      });

      const doc = lastSaved();
      expect(doc.price).toBeGreaterThan(100);
      expect(doc.price).toBe((doc.payment as { amount: number }).amount);
    });

    it("derives capacity from machineType rather than the body", async () => {
      await createBooking(
        validRental({ machineType: "triple", capacity: 15 }),
        {
          status: "pending",
        },
      );

      expect(lastSaved().capacity).toBe(45);
    });

    it("never honours a service discount from the request", async () => {
      await createBooking(validRental({ isServiceDiscount: true }), {
        status: "pending",
      });

      expect(lastSaved().isServiceDiscount).toBe(false);
    });

    it("prices extras from the catalog, not the submitted item", async () => {
      await createBooking(
        validRental({
          selectedExtras: [
            { id: "table-chairs", quantity: 2, price: 0.01, name: "Free" },
          ],
        }),
        { status: "pending" },
      );

      const extras = lastSaved().selectedExtras as { price: number }[];
      expect(extras[0].price).toBeGreaterThan(1);
    });
  });

  describe("rejections", () => {
    it.each([
      [
        "an extras id not in the catalog",
        { selectedExtras: [{ id: "free-machine", quantity: 1 }] },
        400,
        "One or more selected extras are not available",
      ],
      [
        "a mixer in neither the static list nor settings",
        { selectedMixers: ["tequila-sunrise"] },
        400,
        "One or more selected mixers are not available",
      ],
    ])("refuses %s", async (_label, override, status, message) => {
      const result = await createBooking(validRental(override), {
        status: "pending",
      });

      expect(result).toMatchObject({ ok: false, status, message });
      expect(Rental).not.toHaveBeenCalled();
    });

    it("refuses a delivery time outside the operating window", async () => {
      const result = await createBooking(validRental({ rentalTime: "03:00" }), {
        status: "pending",
      });

      expect(result).toMatchObject({ ok: false, status: 400 });
      expect((result as { message: string }).message).toMatch(/Delivery time/);
    });

    it("refuses a ZIP nobody has priced", async () => {
      const result = await createBooking(
        validRental({
          customer: {
            ...validRental().customer,
            address: {
              street: "1 Congress Ave",
              city: "Austin",
              state: "TX",
              zipCode: "78701",
            },
          },
        }),
        { status: "pending" },
      );

      expect(result).toMatchObject({ ok: false, status: 400 });
      expect((result as { message: string }).message).toMatch(
        /don't have a delivery price/,
      );
    });

    it("returns the first zod message for a malformed body", async () => {
      const result = await createBooking(
        { machineType: "hovercraft" },
        {
          status: "pending",
        },
      );

      expect(result).toMatchObject({ ok: false, status: 400 });
      expect(Rental).not.toHaveBeenCalled();
    });
  });

  describe("inventory", () => {
    it("refuses to persist when the machine is already booked", async () => {
      mockAvailable.mockResolvedValueOnce({
        available: false,
        reason: "All double tank machines are booked",
      });

      const result = await createBooking(validRental(), { status: "pending" });

      expect(result).toMatchObject({ ok: false, status: 409 });
      expect(Rental).not.toHaveBeenCalled();
    });

    it("rolls the booking back when the recheck finds an oversell", async () => {
      mockAvailable
        .mockResolvedValueOnce({ available: true })
        .mockResolvedValueOnce({ available: false, reason: "Just taken" });

      const result = await createBooking(validRental(), { status: "pending" });

      expect(result).toMatchObject({ ok: false, status: 409 });
      expect(Rental.deleteOne).toHaveBeenCalled();
    });

    // A symmetric recheck had both racers roll themselves back, rejecting two
    // real customers and leaving the unit unsold.
    it("re-checks asymmetrically, exactly twice", async () => {
      await createBooking(validRental(), { status: "pending" });

      expect(mockAvailable).toHaveBeenCalledTimes(2);
      expect(mockAvailable.mock.calls[1][4]).toMatchObject({
        excludeRentalId: "rental-id",
        ignoreCreatedFrom: expect.any(Date),
        tieBreakId: "rental-id",
      });
    });

    it("re-raises a failed rollback rather than reporting success", async () => {
      mockAvailable
        .mockResolvedValueOnce({ available: true })
        .mockResolvedValueOnce({ available: false });
      (Rental.deleteOne as jest.Mock).mockRejectedValueOnce(
        new Error("mongo down"),
      );

      await expect(
        createBooking(validRental(), { status: "pending" }),
      ).rejects.toThrow("mongo down");
    });
  });

  describe("reusing a hold", () => {
    /** A `pending` hold this browser already owns. */
    const heldDoc = () => {
      const doc: Record<string, unknown> = {
        _id: { toString: () => "held-id" },
        bookingId: "HELD123",
        status: "pending",
        price: 1,
      };
      doc.save = jest.fn().mockResolvedValue(doc);
      return doc;
    };

    // Without this a buyer who cancels and clicks a different funding source
    // holds two units for one cart — and with two triples in stock, two
    // abandons lock them out of their own date.
    it("reprices the existing document instead of inserting a second", async () => {
      const held = heldDoc();
      (Rental.findOne as jest.Mock).mockResolvedValue(held);

      const result = await createBooking(validRental(), {
        status: "pending",
        reuseBookingId: "HELD123",
      });

      expect(Rental).not.toHaveBeenCalled();
      expect(held.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: true,
        bookingId: "HELD123",
        inserted: false,
      });
      expect(held.price).toBeGreaterThan(100);
    });

    it("only ever matches an unpaid pending hold", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(heldDoc());

      await createBooking(validRental(), {
        status: "pending",
        reuseBookingId: "HELD123",
      });

      expect(Rental.findOne).toHaveBeenCalledWith({
        bookingId: "HELD123",
        status: "pending",
        "payment.status": { $ne: "completed" },
      });
    });

    // Otherwise the buyer's own hold reports the machine as unavailable.
    it("excludes the reused hold from the availability check", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(heldDoc());

      await createBooking(validRental(), {
        status: "pending",
        reuseBookingId: "HELD123",
      });

      expect(mockAvailable).toHaveBeenCalledTimes(1);
      expect(mockAvailable.mock.calls[0][4]).toEqual({
        excludeRentalId: "held-id",
      });
    });

    it("inserts a fresh booking when the id matches nothing", async () => {
      (Rental.findOne as jest.Mock).mockResolvedValue(null);

      const result = await createBooking(validRental(), {
        status: "pending",
        reuseBookingId: "GONE",
      });

      expect(result).toMatchObject({ ok: true, inserted: true });
      expect(Rental).toHaveBeenCalled();
    });

    it("does not query for a hold when no id is supplied", async () => {
      await createBooking(validRental(), { status: "pending" });

      expect(Rental.findOne).not.toHaveBeenCalled();
    });
  });

  describe("what it hands back", () => {
    it("returns the totals, rates and mixer labels the email needs", async () => {
      (Settings.findOne as jest.Mock).mockReturnValue(
        settingsFixture({
          fees: { salesTaxRate: 0.07, processingFeeRate: 0.02 },
          mixers: {
            "mango-habanero": { label: "Mango Habanero", price: 22.5 },
          },
        }),
      );

      const result = await createBooking(
        validRental({ selectedMixers: ["mango-habanero"] }),
        { status: "pending" },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.rates).toEqual({ taxRate: 0.07, processingRate: 0.02 });
      expect(result.mixerLabel("mango-habanero")).toBe("Mango Habanero");
      expect(result.resolvedMixers).toEqual(["mango-habanero"]);
      expect(result.totals.finalTotal).toBe(result.rental.price);
      expect(result.bookingId).toBe("BOOKID1234");
      expect(result.rentalId).toBe("rental-id");
    });

    it("falls back to an id when no label is configured", async () => {
      const result = await createBooking(validRental(), { status: "pending" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.mixerLabel("nothing-known")).toBe("nothing-known");
    });
  });
});
