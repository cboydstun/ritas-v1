import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import {
  getNextDay,
  validateDeliveryTime,
  computeOrderTotal,
  calculateRentalDays,
  buildSuccessUrl,
  isBexarCountyZipCode,
} from "@/components/order/utils";
import { OrderFormData } from "@/components/order/types";

describe("calculateRentalDays", () => {
  it("counts a same-day rental as one day", () => {
    expect(calculateRentalDays("2025-06-01", "2025-06-01")).toBe(1);
  });

  it("counts one night as one day", () => {
    expect(calculateRentalDays("2025-06-01", "2025-06-02")).toBe(1);
  });

  it("counts whole calendar days across a longer span", () => {
    expect(calculateRentalDays("2025-06-01", "2025-06-04")).toBe(3);
  });

  it("does not overcharge across the DST fall-back boundary", () => {
    // 2025-11-02 is the US fall-back date: 25 hours long in local time.
    // Differencing local-midnight timestamps and rounding up reported 2 days,
    // billing a one-night rental twice.
    expect(calculateRentalDays("2025-11-02", "2025-11-03")).toBe(1);
  });

  it("does not undercharge across the DST spring-forward boundary", () => {
    // 2025-03-09 is 23 hours long in local time.
    expect(calculateRentalDays("2025-03-09", "2025-03-10")).toBe(1);
  });

  it("counts a multi-day span containing a DST change correctly", () => {
    expect(calculateRentalDays("2025-11-01", "2025-11-04")).toBe(3);
  });

  it("never returns less than one day", () => {
    expect(calculateRentalDays("2025-06-04", "2025-06-01")).toBe(1);
  });
});

describe("getNextDay (Issue 2 — timezone safety)", () => {
  it("returns the next calendar day for a YYYY-MM-DD string", () => {
    // This would fail before the fix if getNextDay parsed bare ISO dates as UTC
    expect(getNextDay("2025-04-14")).toBe("2025-04-15");
  });

  it("handles month boundary correctly", () => {
    expect(getNextDay("2025-04-30")).toBe("2025-05-01");
  });

  it("handles year boundary correctly", () => {
    expect(getNextDay("2024-12-31")).toBe("2025-01-01");
  });

  it("handles leap year correctly", () => {
    expect(getNextDay("2024-02-28")).toBe("2024-02-29");
  });

  it("returns a YYYY-MM-DD string", () => {
    const result = getNextDay("2025-06-15");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("validateDeliveryTime with custom window boundaries", () => {
  it("uses default 8–18 window when no boundaries provided", () => {
    expect(validateDeliveryTime("08:00")).toBe(true);
    expect(validateDeliveryTime("18:00")).toBe(true);
    expect(validateDeliveryTime("07:59")).toBe(false);
    expect(validateDeliveryTime("18:01")).toBe(false);
  });

  it("accepts time inside custom window", () => {
    expect(validateDeliveryTime("09:00", 9, 17)).toBe(true);
    expect(validateDeliveryTime("17:00", 9, 17)).toBe(true);
  });

  it("rejects time outside custom window", () => {
    expect(validateDeliveryTime("08:00", 9, 17)).toBe(false);
    expect(validateDeliveryTime("17:01", 9, 17)).toBe(false);
  });

  it("still returns true for ANY regardless of window", () => {
    expect(validateDeliveryTime("ANY", 9, 17)).toBe(true);
  });
});

describe("computeOrderTotal with settings overrides", () => {
  const baseFormData: OrderFormData = {
    machineType: "single",
    capacity: 15,
    selectedMixers: [],
    selectedExtras: [],
    price: 0,
    rentalDate: "2025-06-01",
    rentalTime: "10:00",
    returnDate: "2025-06-02",
    returnTime: "10:00",
    customer: {
      name: "Test",
      email: "test@example.com",
      phone: "2105551234",
      address: {
        street: "123 Main",
        city: "SA",
        state: "TX",
        zipCode: "78201",
      },
    },
    notes: "",
    isServiceDiscount: false,
  };

  it("uses default rates when no settings provided", () => {
    const result = computeOrderTotal(baseFormData);
    // subtotal = 124.95 * 1 + 20 = 144.95
    // processingFee = 144.95 * 0.03 = 4.35 (rounded)
    // salesTax = (144.95 + 4.35) * 0.0825 = 12.32 (rounded) — QB math
    // cashPrice = 144.95 + 144.95 * 0.0825 = 156.91
    expect(result.processingFee).toBeCloseTo(4.35, 2);
    expect(result.salesTax).toBeCloseTo(12.32, 2);
    expect(result.cashPrice).toBeCloseTo(156.91, 2);
    expect(result.finalTotal).toBeCloseTo(161.62, 2);
  });

  it("applies custom serviceDiscountRate", () => {
    const formWithDiscount = { ...baseFormData, isServiceDiscount: true };
    const result = computeOrderTotal(formWithDiscount, {
      fees: { serviceDiscountRate: 0.2 },
    });
    // subtotal = 144.95, discount = 144.95 * 0.2 = 28.99
    expect(result.serviceDiscountAmount).toBeCloseTo(144.95 * 0.2, 2);
  });

  it("applies custom salesTaxRate from settings — tax base includes processing fee", () => {
    const result = computeOrderTotal(baseFormData, {
      fees: { salesTaxRate: 0.1 },
    });
    // processingFee = 144.95 * 0.03 = 4.35
    // salesTax = (144.95 + 4.35) * 0.1 = 14.93
    expect(result.processingFee).toBeCloseTo(4.35, 2);
    expect(result.salesTax).toBeCloseTo(14.93, 2);
  });

  it("applies custom deliveryFee from settings", () => {
    const result = computeOrderTotal(baseFormData, {
      fees: { deliveryFee: 50 },
    });
    // subtotal = 124.95 + 50 = 174.95
    expect(result.deliveryFee).toBe(50);
    expect(result.subtotal).toBeCloseTo(174.95, 2);
  });

  it("matches the QuickBooks reference invoice (45L triple + 2 mixers + 1 flat extra + 2 per-day extras, 1 day)", () => {
    // QB invoice: machine $174.95 + Margarita $19.95 + Strawberry Daiquiri $24.95
    // + Pina Colada extra mixer $24.95 (flat) + Popcorn $49.95 + Cotton Candy $49.95 + Delivery $20
    // = items $364.70 → processing $10.94 → tax $30.99 → cash $394.79 → online $406.63
    const qbForm: OrderFormData = {
      ...baseFormData,
      machineType: "triple",
      capacity: 45,
      selectedMixers: ["margarita", "strawberry-daiquiri"],
      selectedExtras: [
        {
          id: "mixer-pina-colada",
          name: "Pina Colada Extra Mixer",
          description: "",
          price: 24.95,
          quantity: 1,
          pricingType: "flat",
        },
        {
          id: "popcorn-machine",
          name: "Popcorn Machine",
          description: "",
          price: 49.95,
          quantity: 1,
        },
        {
          id: "cotton-candy",
          name: "Cotton Candy Machine",
          description: "",
          price: 49.95,
          quantity: 1,
        },
      ],
    };
    const result = computeOrderTotal(qbForm);
    expect(result.subtotal).toBeCloseTo(364.7, 2);
    expect(result.processingFee).toBeCloseTo(10.94, 2);
    expect(result.salesTax).toBeCloseTo(30.99, 2);
    expect(result.cashPrice).toBeCloseTo(394.79, 2);
    expect(result.finalTotal).toBeCloseTo(406.63, 2);
  });

  describe("extras pricing comes from the catalog, not the payload", () => {
    it("ignores a price supplied on the extra itself", () => {
      const tampered: OrderFormData = {
        ...baseFormData,
        selectedExtras: [
          {
            id: "table-chairs",
            name: "Table & Chairs Set",
            description: "",
            price: -500,
            quantity: 1,
          },
        ],
      };

      const result = computeOrderTotal(tampered);
      // Catalog price is 19.95, charged per day for a 1-day rental.
      expect(result.extrasTotal).toBeCloseTo(19.95, 2);
      expect(result.finalTotal).toBeGreaterThan(0);
    });

    it("cannot be driven negative by a crafted extra", () => {
      const tampered: OrderFormData = {
        ...baseFormData,
        selectedExtras: [
          {
            id: "totally-made-up",
            name: "Discount",
            description: "",
            price: -1000,
            quantity: 5,
          },
        ],
      };

      const result = computeOrderTotal(tampered);
      // Unknown ids contribute nothing; the API layer rejects them outright.
      expect(result.extrasTotal).toBe(0);
      expect(result.finalTotal).toBeCloseTo(161.62, 2);
    });

    it("honours the catalog pricingType rather than the payload's", () => {
      const twoDays: OrderFormData = {
        ...baseFormData,
        rentalDate: "2025-06-01",
        returnDate: "2025-06-03",
        selectedExtras: [
          {
            id: "mixer-margarita",
            name: "Margarita Mixer — Extra Mixer",
            description: "",
            price: 19.95,
            quantity: 1,
            // Claiming per-day on a flat item would double the charge.
            pricingType: "per-day",
          },
        ],
      };

      const result = computeOrderTotal(twoDays);
      expect(result.rentalDays).toBe(2);
      expect(result.extrasTotal).toBeCloseTo(19.95, 2);
    });
  });
});

describe("buildSuccessUrl", () => {
  it("carries the booking id and machine type", () => {
    const url = buildSuccessUrl("bk_test_123", "double");

    expect(url).toContain("/success?");
    expect(url).toContain("bookingId=bk_test_123");
    expect(url).toContain("machineType=double");
  });

  it("joins selected mixers into one param", () => {
    const url = buildSuccessUrl("bk_1", "triple", ["margarita", "pina-colada"]);

    expect(url).toContain("mixers=margarita%2Cpina-colada");
  });

  it("omits the mixers param when none are selected", () => {
    expect(buildSuccessUrl("bk_1", "single", [])).not.toContain("mixers");
    expect(buildSuccessUrl("bk_1", "single")).not.toContain("mixers");
  });

  // GA4 records the whole query string as page_location. A customer name here
  // ships PII to Google and makes every booking its own unique page path,
  // which is what stopped /success from working as a conversion page.
  it("emits nothing beyond the three params /success reads", () => {
    const url = buildSuccessUrl("bk_1", "double", ["margarita"]);
    const keys = Array.from(
      new URL(url, "https://www.satxritas.com").searchParams.keys(),
    );

    expect(keys.sort()).toEqual(["bookingId", "machineType", "mixers"]);
  });
});

describe("isBexarCountyZipCode", () => {
  it("accepts both ends of the 782xx San Antonio range", () => {
    expect(isBexarCountyZipCode("78201")).toBe(true);
    // The generator started at 78200 and stopped at 78298, so this real ZIP
    // was turned away at the address step.
    expect(isBexarCountyZipCode("78299")).toBe(true);
  });

  it("rejects the unassigned 78200", () => {
    expect(isBexarCountyZipCode("78200")).toBe(false);
  });

  it("rejects a ZIP outside Bexar County", () => {
    expect(isBexarCountyZipCode("75201")).toBe(false);
  });
});
