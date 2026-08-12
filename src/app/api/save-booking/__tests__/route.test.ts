/**
 * @jest-environment node
 */
import { POST } from "../route";
import { Rental } from "@/models/rental";
import { isMachineAvailable } from "@/lib/inventory";
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

// The route builds a document and calls `.save()` on it, so the constructor is
// what has to be observable — that is where the server-side price lands.
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
    { deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) },
  ),
}));

// The route is rate limited to 5 requests per IP per 10 minutes, and every
// test here shares one process. The body-size cap and JSON parsing in
// `guardPublicWrite` still run — only the counter is neutralised.
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

// nanoid ships ESM only, which the CommonJS test transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "bookid1234" }));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: {}, error: null }) },
  })),
}));

jest.mock("twilio", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: { create: jest.fn().mockResolvedValue({ sid: "sms" }) },
  })),
}));

const mockAvailable = isMachineAvailable as jest.MockedFunction<
  typeof isMachineAvailable
>;

/** A date far enough ahead that the "not in the past" refinement passes. */
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
  ...overrides,
});

const post = (rentalData: Record<string, unknown>) =>
  POST(
    new Request("http://localhost:3000/api/save-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalData }),
    }),
  );

/** The document handed to `new Rental(...)` by the most recent request. */
const lastSaved = () => savedDocs[savedDocs.length - 1];

describe("POST /api/save-booking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    savedDocs.length = 0;
    mockAvailable.mockResolvedValue({ available: true });
    (Settings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
  });

  describe("money", () => {
    it("ignores a price supplied by the caller and stores its own total", async () => {
      const response = await post(validRental({ price: 1 }));

      expect(response.status).toBe(200);
      const doc = lastSaved();
      // double base 149.95 + 2 mixers + $20 delivery, taxed and fee'd.
      expect(doc.price).toBeGreaterThan(100);
      expect(doc.price).toBe((doc.payment as { amount: number }).amount);
    });

    it("derives capacity from machineType rather than the request body", async () => {
      const response = await post(
        validRental({ machineType: "triple", capacity: 15 }),
      );

      expect(response.status).toBe(200);
      expect(lastSaved().capacity).toBe(45);
    });

    it("never honours a service discount from the request", async () => {
      await post(validRental({ isServiceDiscount: true }));

      expect(lastSaved().isServiceDiscount).toBe(false);
    });

    it("prices extras from the catalog, not from the submitted item", async () => {
      const response = await post(
        validRental({
          selectedExtras: [
            { id: "table-chairs", quantity: 2, price: 0.01, name: "Free" },
          ],
        }),
      );

      expect(response.status).toBe(200);
      const extras = lastSaved().selectedExtras as {
        id: string;
        price: number;
      }[];
      expect(extras).toHaveLength(1);
      expect(extras[0].price).toBeGreaterThan(1);
    });

    it("rejects an extras id that is not in the catalog", async () => {
      const response = await post(
        validRental({ selectedExtras: [{ id: "free-machine", quantity: 1 }] }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        message: "One or more selected extras are not available",
      });
    });
  });

  describe("mixers", () => {
    // The order form renders a card for every flavour in Settings.mixers, so
    // pinning the request schema to the static four rejected real bookings.
    it("accepts a flavour an admin added in settings", async () => {
      (Settings.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          mixers: {
            "mango-habanero": { label: "Mango Habanero", price: 22.5 },
          },
        }),
      });

      const response = await post(
        validRental({ selectedMixers: ["mango-habanero"] }),
      );

      expect(response.status).toBe(200);
      expect(lastSaved().selectedMixers).toEqual(["mango-habanero"]);
    });

    it("rejects a flavour that is in neither the static list nor settings", async () => {
      const response = await post(
        validRental({ selectedMixers: ["tequila-sunrise"] }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        message: "One or more selected mixers are not available",
      });
    });

    it("rejects more mixers than the machine has tanks", async () => {
      const response = await post(
        validRental({
          machineType: "single",
          selectedMixers: ["margarita", "pina-colada"],
        }),
      );

      expect(response.status).toBe(400);
    });
  });

  describe("inventory", () => {
    it("refuses to persist when the machine is already booked", async () => {
      mockAvailable.mockResolvedValueOnce({
        available: false,
        reason: "All double tank machines are booked for 2026-03-01",
      });

      const response = await post(validRental());

      expect(response.status).toBe(409);
      expect(Rental).not.toHaveBeenCalled();
    });

    it("rolls the booking back when the post-write recheck finds an oversell", async () => {
      mockAvailable
        .mockResolvedValueOnce({ available: true })
        .mockResolvedValueOnce({ available: false, reason: "Just taken" });

      const response = await post(validRental());

      expect(response.status).toBe(409);
      expect(Rental.deleteOne).toHaveBeenCalledWith({
        _id: { toString: expect.any(Function) },
      });
    });

    it("re-checks asymmetrically so two racers cannot both roll back", async () => {
      await post(validRental());

      // Only holds that already existed when ours landed may displace it —
      // a symmetric recheck rejected both racers and sold nothing.
      expect(mockAvailable).toHaveBeenCalledTimes(2);
      const recheckOptions = mockAvailable.mock.calls[1][4];
      expect(recheckOptions).toMatchObject({
        excludeRentalId: "rental-id",
        ignoreCreatedFrom: expect.any(Date),
      });
    });
  });

  describe("notifications", () => {
    it("still returns 200 when the email provider fails", async () => {
      const { Resend } = jest.requireMock("resend") as {
        Resend: jest.Mock;
      };
      Resend.mockImplementationOnce(() => ({
        emails: { send: jest.fn().mockRejectedValue(new Error("resend down")) },
      }));

      const response = await post(validRental());

      expect(response.status).toBe(200);
    });
  });

  describe("validation", () => {
    it("rejects a rental date in the past", async () => {
      const response = await post(
        validRental({ rentalDate: "2020-01-01", returnDate: "2020-01-02" }),
      );

      expect(response.status).toBe(400);
    });

    it("rejects a return date before the rental date", async () => {
      const response = await post(
        validRental({ rentalDate: futureDate(11), returnDate: futureDate(10) }),
      );

      expect(response.status).toBe(400);
    });

    // These two rules lived only in OrderForm/DetailsStep, so a direct POST
    // could book a 03:00 delivery to any ZIP in the country.
    it("rejects a delivery time outside the operating window", async () => {
      const response = await post(validRental({ rentalTime: "03:00" }));

      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/Delivery time/);
    });

    it("rejects a pickup time outside the operating window", async () => {
      const response = await post(validRental({ returnTime: "23:30" }));

      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/Pickup time/);
    });

    it("accepts ANY, which is what the form submits by default", async () => {
      const response = await post(
        validRental({ rentalTime: "ANY", returnTime: "ANY" }),
      );

      expect(response.status).toBe(200);
    });

    it("rejects a delivery address outside Bexar County", async () => {
      const response = await post(
        validRental({
          customer: {
            name: "Sam Rivera",
            email: "sam@example.com",
            phone: "(210) 555-0134",
            address: {
              street: "1 Congress Ave",
              city: "Austin",
              state: "TX",
              zipCode: "78701",
            },
          },
        }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/Bexar County/);
    });
  });
});
