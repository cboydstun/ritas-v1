import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import {
  getNextDay,
  validateDeliveryTime,
  computeOrderTotal,
} from "@/components/order/utils";
import { OrderFormData } from "@/components/order/types";

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
    // subtotal = 124.95 * 1 + 20 = 144.95; tax = 144.95 * 0.0825
    expect(result.salesTax).toBeCloseTo(144.95 * 0.0825, 2);
    expect(result.processingFee).toBeCloseTo(144.95 * 0.03, 2);
  });

  it("applies custom serviceDiscountRate", () => {
    const formWithDiscount = { ...baseFormData, isServiceDiscount: true };
    const result = computeOrderTotal(formWithDiscount, {
      fees: { serviceDiscountRate: 0.2 },
    });
    // subtotal = 144.95, discount = 144.95 * 0.2 = 28.99
    expect(result.serviceDiscountAmount).toBeCloseTo(144.95 * 0.2, 2);
  });

  it("applies custom salesTaxRate from settings", () => {
    const result = computeOrderTotal(baseFormData, {
      fees: { salesTaxRate: 0.1 },
    });
    expect(result.salesTax).toBeCloseTo(144.95 * 0.1, 2);
  });

  it("applies custom deliveryFee from settings", () => {
    const result = computeOrderTotal(baseFormData, {
      fees: { deliveryFee: 50 },
    });
    // subtotal = 124.95 + 50 = 174.95
    expect(result.deliveryFee).toBe(50);
    expect(result.subtotal).toBeCloseTo(174.95, 2);
  });
});
