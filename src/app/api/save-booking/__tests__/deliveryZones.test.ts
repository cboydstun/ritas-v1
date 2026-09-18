/**
 * @jest-environment node
 *
 * The delivery-zone half of the public checkout's trust boundary: where the
 * surcharge comes from, who gets refused, and what the order minimum is
 * measured against.
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

jest.mock("@/models/settings", () => ({ Settings: { findOne: jest.fn() } }));

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

const futureDate = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** `single` at the shipped $124.95, one night: a $144.90 rental subtotal. */
const booking = (zipCode: string, overrides: Record<string, unknown> = {}) => ({
  machineType: "single",
  selectedMixers: ["margarita"],
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
      zipCode,
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

const ZERO_LADDER = { free: 0, low: 0, standard: 0, high: 0, premium: 0 };

function settings(
  zones: Record<string, unknown> = {},
  fees: Record<string, unknown> = {},
) {
  (Settings.findOne as jest.Mock).mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      fees,
      deliveryZones: {
        customFees: { "78205": 0, "78015": 75 },
        insideZips: ["78205", "78210"],
        outsideZips: ["78015"],
        tierMinimums: ZERO_LADDER,
        ...zones,
      },
    }),
  });
}

const lastSaved = () => savedDocs[savedDocs.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  savedDocs.length = 0;
  (isMachineAvailable as jest.Mock).mockResolvedValue({ available: true });
  settings();
});

/**
 * The stored total for one cart at one ZIP.
 *
 * Written as a relationship rather than a literal: the rental half of the cart
 * is identical either way, so the whole difference between two ZIPs must be
 * the surcharge plus the 3% processing fee and 8.25% tax that ride on it.
 * Hardcoding two totals would pass just as well if the surcharge were being
 * taxed twice.
 */
const priceAt = async (
  zipCode: string,
  zones?: Record<string, unknown>,
): Promise<number> => {
  if (zones) settings(zones);
  savedDocs.length = 0;
  const response = await post(booking(zipCode));
  expect(response.status).toBe(200);
  const price = lastSaved().price as number;
  if (zones) settings();
  return price;
};

/**
 * What $N of surcharge adds to a total once the 3% fee and 8.25% tax ride on it.
 *
 * Compared to within a cent, not exactly: every figure goes through
 * `roundCurrency` as the total accumulates, so `sum(round(x)) !== round(sum(x))`
 * and the two totals round independently. A cent of slack here is the right
 * tolerance; a hardcoded pair of totals would be no tighter and would pass just
 * as happily if the surcharge were taxed twice.
 */
const surchargeCost = (fee: number) => fee * 1.03 * 1.0825;

describe("the base delivery fee is charged on top of the surcharge", () => {
  it("bills a ZIP priced at $0 for the base fee, not for nothing", async () => {
    // The failure this exists to close: 25 seeded ZIPs carry no surcharge, and
    // without the base term each of them bought a truck, two people and a
    // round trip for nothing — having charged a flat $20 the day before.
    const free = await priceAt("78205"); // $0 surcharge
    const noDelivery = await priceAt("78205", { baseFee: 0 });

    expect(free - noDelivery).toBeCloseTo(surchargeCost(20), 1);
  });

  it("adds the base fee to a ZIP that also carries a surcharge", async () => {
    const priced = await priceAt("78015", { baseFee: 20 }); // $75 + $20
    const surchargeOnly = await priceAt("78015", { baseFee: 0 });

    expect(priced - surchargeOnly).toBeCloseTo(surchargeCost(20), 1);
  });

  it("never reads the base fee from the request body", async () => {
    const honest = await priceAt("78205");

    savedDocs.length = 0;
    await post(booking("78205", { deliveryFee: 0, price: 1 }));

    expect(lastSaved().price).toBeCloseTo(honest, 2);
  });
});

describe("the surcharge comes from the ZIP", () => {
  it("charges the ZIP's own figure, and nothing for a $0 ZIP", async () => {
    const priced = await priceAt("78015"); // $75
    const free = await priceAt("78205"); // $0

    expect(priced - free).toBeCloseTo(surchargeCost(75), 1);
  });

  it("ignores a surcharge the caller tries to supply", async () => {
    // `rentalDataSchema` strips unknown fields, so the body cannot carry a fee
    // at all — assert the behaviour rather than the mechanism.
    const honest = await priceAt("78015");

    savedDocs.length = 0;
    await post(booking("78015", { deliveryFee: 0, price: 1 }));

    expect(lastSaved().price).toBeCloseTo(honest, 2);
  });

  it("follows the ZIP even when the city says otherwise", async () => {
    savedDocs.length = 0;
    await post(
      booking("78015", {
        customer: {
          name: "Sam Rivera",
          email: "sam@example.com",
          phone: "(210) 555-0134",
          address: {
            street: "1 Alamo Plaza",
            city: "San Antonio",
            state: "TX",
            zipCode: "78015",
          },
        },
      }),
    );
    const claimedSanAntonio = lastSaved().price as number;

    expect(claimedSanAntonio - (await priceAt("78205"))).toBeCloseTo(
      surchargeCost(75),
      1,
    );
  });
});

describe("an unpriced ZIP is refused, not delivered to free", () => {
  it("refuses a ZIP with no fee anywhere", async () => {
    const response = await post(booking("75201"));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(
      /don't have a delivery price/,
    );
    expect(Rental).not.toHaveBeenCalled();
  });

  it("refuses a ZIP that is on a zone list but carries no fee", async () => {
    // Zone membership is geography. Without this the ZIP would pass the gate
    // and then price at `getDeliveryFee`'s `?? 0` — free delivery, granted
    // silently, to a ZIP nobody set a price for.
    const response = await post(booking("78210"));
    expect(response.status).toBe(400);
    expect(Rental).not.toHaveBeenCalled();
  });

  it("refuses everything when no ZIP has been priced at all", async () => {
    settings({ customFees: {} });
    expect((await post(booking("78205"))).status).toBe(400);
  });
});

describe("the order minimum", () => {
  it("does not apply when the band's floor is 0", async () => {
    expect((await post(booking("78015"))).status).toBe(200);
  });

  it("refuses a cart under its ZIP's floor and quotes both numbers", async () => {
    settings({ tierMinimums: { ...ZERO_LADDER, high: 200 } });

    const response = await post(booking("78015"));
    expect(response.status).toBe(400);
    const { message } = await response.json();
    expect(message).toMatch(/78015 have a \$200 rental minimum/);
    expect(message).toMatch(/Your rentals come to \$144\.90/);
    expect(Rental).not.toHaveBeenCalled();
  });

  it("measures the floor on rentals alone — the surcharge cannot clear it", async () => {
    // $144.90 of rentals plus a $75 surcharge is $219.90, over the $200 floor.
    // The surcharge is the cost the minimum exists to cover, so it must not be
    // what clears it.
    settings({ tierMinimums: { ...ZERO_LADDER, high: 200 } });
    expect((await post(booking("78015"))).status).toBe(400);
  });

  it("accepts the same cart in a band with a lower floor", async () => {
    settings({ tierMinimums: { ...ZERO_LADDER, high: 200, free: 100 } });
    expect((await post(booking("78205"))).status).toBe(200);
  });

  it("clears the floor on rentals alone when the cart is big enough", async () => {
    settings({ tierMinimums: { ...ZERO_LADDER, high: 100 } });
    expect((await post(booking("78015"))).status).toBe(200);
  });

  it("falls back to the global minimum for a band with none configured", async () => {
    settings({ tierMinimums: undefined }, { minOrderAmount: 500 });
    const response = await post(booking("78015"));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/\$500 rental minimum/);
  });

  it("applies no floor at all when nothing is configured anywhere", async () => {
    settings({ tierMinimums: undefined }, {});
    expect((await post(booking("78015"))).status).toBe(200);
  });
});
