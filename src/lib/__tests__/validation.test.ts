import { z } from "zod";
import {
  MACHINE_CAPACITY,
  escapeHtml,
  fingerprintHashSchema,
  MAX_RANGE_DAYS,
  rentalDataSchema,
  todayLocalIso,
} from "@/lib/validation";
import { EMAIL_PATTERN, PHONE_PATTERN, ZIP_PATTERN } from "@/lib/dates";
import {
  validateEmail,
  validatePhone,
  validateZipCode,
} from "@/components/order/utils";

/** The exact shape the request schemas use for a customer email. */
const customerEmailSchema = z
  .string()
  .trim()
  .regex(EMAIL_PATTERN, "Invalid email address")
  .max(200);

const validRental = () => ({
  machineType: "triple",
  capacity: 45,
  selectedMixers: ["margarita"],
  selectedExtras: [{ id: "table-chairs", quantity: 2 }],
  rentalDate: todayLocalIso(),
  rentalTime: "10:00",
  returnDate: todayLocalIso(),
  returnTime: "18:00",
  customer: {
    name: "Test Customer",
    email: "test@example.com",
    phone: "(210) 555-1234",
    address: {
      street: "123 Main St",
      city: "San Antonio",
      state: "TX",
      zipCode: "78201",
    },
  },
  notes: "Leave at the gate",
});

describe("rentalDataSchema", () => {
  it("accepts a well-formed booking", () => {
    expect(rentalDataSchema.safeParse(validRental()).success).toBe(true);
  });

  it("strips fields the client is not allowed to set", () => {
    const parsed = rentalDataSchema.parse({
      ...validRental(),
      // Every one of these used to reach Mongo via `new Rental({ ...body })`.
      price: 1,
      isServiceDiscount: true,
      status: "confirmed",
      bookingId: "FORGED",
      _id: "deadbeefdeadbeefdeadbeef",
      payment: { amount: 1, status: "completed" },
    });

    expect(parsed).not.toHaveProperty("price");
    expect(parsed).not.toHaveProperty("isServiceDiscount");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("bookingId");
    expect(parsed).not.toHaveProperty("_id");
    expect(parsed).not.toHaveProperty("payment");
  });

  it("drops price and pricingType from selected extras", () => {
    const parsed = rentalDataSchema.parse({
      ...validRental(),
      selectedExtras: [
        { id: "table-chairs", price: -500, pricingType: "per-day", name: "x" },
      ],
    });

    expect(parsed.selectedExtras).toEqual([{ id: "table-chairs" }]);
  });

  it("rejects a return date before the rental date", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      rentalDate: "2030-06-10",
      returnDate: "2030-06-09",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a rental date in the past", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      rentalDate: "2020-01-01",
      returnDate: "2020-01-02",
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed and impossible dates", () => {
    for (const rentalDate of ["06/10/2030", "2030-6-10", "2030-02-30"]) {
      const result = rentalDataSchema.safeParse({
        ...validRental(),
        rentalDate,
        returnDate: rentalDate,
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts the ANY delivery-time sentinel", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      rentalTime: "ANY",
      returnTime: "ANY",
    });

    expect(result.success).toBe(true);
  });

  it("rejects more mixers than the machine has tanks", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      machineType: "single",
      capacity: 15,
      selectedMixers: ["margarita", "pina-colada"],
    });

    expect(result.success).toBe(false);
  });

  // An admin can add flavours in /admin/settings, so the valid set is dynamic
  // and membership is checked at the route layer via resolveSelectedMixers.
  // The schema's job is only to reject ids that are malformed.
  it("accepts a well-formed mixer id the static list does not know", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      selectedMixers: ["mango-habanero"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed mixer id", () => {
    for (const bad of ["", " ", "a".repeat(65), { $ne: null }, "not an id"]) {
      const result = rentalDataSchema.safeParse({
        ...validRental(),
        selectedMixers: [bad],
      });

      expect(result.success).toBe(false);
    }
  });

  it("bounds free-text notes", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      notes: "x".repeat(5000),
    });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed ZIP, phone and email", () => {
    const base = validRental();
    const cases = [
      { ...base, customer: { ...base.customer, email: "not-an-email" } },
      { ...base, customer: { ...base.customer, phone: "12" } },
      {
        ...base,
        customer: {
          ...base.customer,
          address: { ...base.customer.address, zipCode: "ABCDE" },
        },
      },
    ];

    for (const candidate of cases) {
      expect(rentalDataSchema.safeParse(candidate).success).toBe(false);
    }
  });
});

describe("MACHINE_CAPACITY", () => {
  it("pins one capacity per machine type", () => {
    expect(MACHINE_CAPACITY).toEqual({ single: 15, double: 30, triple: 45 });
  });
});

describe("fingerprintHashSchema", () => {
  it("accepts a hex digest", () => {
    expect(fingerprintHashSchema.safeParse("a".repeat(32)).success).toBe(true);
  });

  it("rejects a Mongo operator object", () => {
    expect(fingerprintHashSchema.safeParse({ $ne: null }).success).toBe(false);
  });

  it("rejects non-hex strings", () => {
    expect(fingerprintHashSchema.safeParse("../../etc/passwd").success).toBe(
      false,
    );
  });
});

describe("todayLocalIso", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // Vercel functions run UTC. Reading the server clock's local date meant that
  // after 19:00 Central the server was already on tomorrow, so it rejected the
  // same-day bookings the client's date picker had just offered.
  it("returns the Central date, not the UTC date, late in the evening", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T23:30:00Z"));
    expect(todayLocalIso()).toBe("2026-08-11");
  });

  it("accepts a same-day booking made at 23:30 UTC", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T23:30:00Z"));
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      rentalDate: "2026-08-11",
      returnDate: "2026-08-11",
    });
    expect(result.success).toBe(true);
  });
});

describe("rentalDataSchema range cap", () => {
  it(`rejects a span longer than ${MAX_RANGE_DAYS} days`, () => {
    const start = todayLocalIso();
    const tooFar = new Date(`${start}T00:00:00Z`);
    tooFar.setUTCDate(tooFar.getUTCDate() + MAX_RANGE_DAYS + 1);

    const result = rentalDataSchema.safeParse({
      ...validRental(),
      rentalDate: start,
      returnDate: tooFar.toISOString().slice(0, 10),
    });

    expect(result.success).toBe(false);
  });

  it(`accepts a span of exactly ${MAX_RANGE_DAYS} days`, () => {
    const start = todayLocalIso();
    const edge = new Date(`${start}T00:00:00Z`);
    edge.setUTCDate(edge.getUTCDate() + MAX_RANGE_DAYS);

    const result = rentalDataSchema.safeParse({
      ...validRental(),
      rentalDate: start,
      returnDate: edge.toISOString().slice(0, 10),
    });

    expect(result.success).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in customer-supplied text", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands and apostrophes", () => {
    expect(escapeHtml("Bob & O'Neil")).toBe("Bob &amp; O&#39;Neil");
  });

  it("renders nullish values as an empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("client/server field agreement", () => {
  // These reimplemented the server's rules and email diverged: the client's
  // /^[^\s@]+@[^\s@]+\.[^\s@]+$/ was looser than zod's .email(), so a value
  // could clear all five wizard steps and be rejected at submit.
  const cases = [
    ["sam@example.com", true],
    ["sam.rivera+tag@sub.example.co.uk", true],
    ["a@b..c", false],
    [".sam@example.com", false],
    ["sam@example", false],
    ["sam @example.com", false],
    ["", false],
  ] as const;

  it.each(cases)("client and server agree on %s", (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
    expect(customerEmailSchema.safeParse(email).success).toBe(expected);
  });

  it.each([
    ["(210) 555-0134", true],
    ["210-555-0134", true],
    ["555-0134", false],
  ] as const)("client and server agree on phone %s", (phone, expected) => {
    expect(validatePhone(phone)).toBe(expected);
    expect(PHONE_PATTERN.test(phone)).toBe(expected);
  });

  it.each([
    ["78205", true],
    ["78205-1234", true],
    ["7820", false],
  ] as const)("client and server agree on ZIP %s", (zip, expected) => {
    expect(validateZipCode(zip)).toBe(expected);
    expect(ZIP_PATTERN.test(zip)).toBe(expected);
  });
});
