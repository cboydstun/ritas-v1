import {
  MACHINE_CAPACITY,
  escapeHtml,
  fingerprintHashSchema,
  rentalDataSchema,
  todayLocalIso,
} from "@/lib/validation";

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

  it("rejects an unknown mixer", () => {
    const result = rentalDataSchema.safeParse({
      ...validRental(),
      selectedMixers: ["tequila-sunrise"],
    });

    expect(result.success).toBe(false);
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
