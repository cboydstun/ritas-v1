import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import { calculatePrice } from "@/lib/pricing";

describe("calculatePrice", () => {
  describe("single machine", () => {
    it("returns zero mixerPrice when no mixers selected", () => {
      const result = calculatePrice("single", []);
      expect(result.mixerPrice).toBe(0);
      expect(result.basePrice).toBe(124.95);
    });

    it("returns correct mixerPrice for one mixer", () => {
      const result = calculatePrice("single", ["margarita"]);
      expect(result.mixerPrice).toBe(19.95);
    });

    it("returns correct mixerPrice for pina-colada", () => {
      const result = calculatePrice("single", ["pina-colada"]);
      expect(result.mixerPrice).toBe(24.95);
    });
  });

  describe("double machine — multi-mixer pricing (Issue 1 regression)", () => {
    it("sums two different mixer prices instead of multiplying one price by 2", () => {
      // Bug: old code would compute 2 × $19.95 = $39.90
      // Correct: $19.95 + $24.95 = $44.90
      const result = calculatePrice("double", ["margarita", "pina-colada"]);
      expect(result.mixerPrice).toBe(44.9);
    });

    it("sums two identical mixer prices correctly", () => {
      // 2 × $19.95 = $39.90  (same as old code, but only a coincidence for equal prices)
      const result = calculatePrice("double", ["margarita", "margarita"]);
      expect(result.mixerPrice).toBeCloseTo(39.9, 2);
    });

    it("returns zero mixerPrice when no mixers", () => {
      const result = calculatePrice("double", []);
      expect(result.mixerPrice).toBe(0);
    });

    it("handles single mixer selection on double machine", () => {
      const result = calculatePrice("double", ["margarita"]);
      expect(result.mixerPrice).toBe(19.95);
    });
  });

  describe("triple machine — multi-mixer pricing", () => {
    it("sums all three mixer prices", () => {
      // margarita $19.95 + pina-colada $24.95 + strawberry-daiquiri $24.95 = $69.85
      const result = calculatePrice("triple", [
        "margarita",
        "pina-colada",
        "strawberry-daiquiri",
      ]);
      expect(result.mixerPrice).toBeCloseTo(69.85, 2);
    });
  });

  describe("total calculation sanity", () => {
    it("includes delivery fee in total", () => {
      const result = calculatePrice("single", []);
      // subtotal = 124.95 + 0 + 20 = 144.95
      const expectedSubtotal = 144.95;
      const expectedTax = expectedSubtotal * 0.0825;
      const expectedProcessing = expectedSubtotal * 0.03;
      const expectedTotal = expectedSubtotal + expectedTax + expectedProcessing;
      expect(result.total).toBeCloseTo(expectedTotal, 2);
    });
  });
});
