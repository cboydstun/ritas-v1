import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import { getNextDay } from "@/components/order/utils";

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
