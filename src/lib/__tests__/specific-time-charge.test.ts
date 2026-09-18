import {
  DEFAULT_SPECIFIC_TIME_FEE,
  isSpecificTime,
  resolveSpecificTimeCharge,
  specificTimeFeeNote,
} from "@/lib/specific-time-charge";

const fees = {
  specificDeliveryTimeFee: DEFAULT_SPECIFIC_TIME_FEE,
  specificPickupTimeFee: DEFAULT_SPECIFIC_TIME_FEE,
};

describe("isSpecificTime", () => {
  it("treats ANY as flexible", () => {
    expect(isSpecificTime("ANY")).toBe(false);
  });

  it("treats a clock time as specific", () => {
    expect(isSpecificTime("10:00")).toBe(true);
  });

  it("treats an empty value as flexible, so a half-filled form is never billed", () => {
    expect(isSpecificTime("")).toBe(false);
    expect(isSpecificTime(undefined)).toBe(false);
  });
});

describe("resolveSpecificTimeCharge", () => {
  it("charges nothing when both legs are flexible", () => {
    expect(
      resolveSpecificTimeCharge({
        rentalTime: "ANY",
        returnTime: "ANY",
        ...fees,
      }),
    ).toBe(0);
  });

  it("charges the delivery fee alone for a pinned delivery", () => {
    expect(
      resolveSpecificTimeCharge({
        rentalTime: "10:00",
        returnTime: "ANY",
        ...fees,
      }),
    ).toBe(DEFAULT_SPECIFIC_TIME_FEE);
  });

  it("charges the pickup fee alone for a pinned pickup", () => {
    expect(
      resolveSpecificTimeCharge({
        rentalTime: "ANY",
        returnTime: "16:00",
        specificDeliveryTimeFee: 7,
        specificPickupTimeFee: 11,
      }),
    ).toBe(11);
  });

  it("sums both legs when both are pinned", () => {
    expect(
      resolveSpecificTimeCharge({
        rentalTime: "10:00",
        returnTime: "16:00",
        ...fees,
      }),
    ).toBe(DEFAULT_SPECIFIC_TIME_FEE * 2);
  });

  it("honours a fee of zero", () => {
    expect(
      resolveSpecificTimeCharge({
        rentalTime: "10:00",
        returnTime: "16:00",
        specificDeliveryTimeFee: 0,
        specificPickupTimeFee: 0,
      }),
    ).toBe(0);
  });

  it("ships at $25 per leg", () => {
    expect(DEFAULT_SPECIFIC_TIME_FEE).toBe(25);
  });
});

describe("specificTimeFeeNote", () => {
  it("names a positive fee", () => {
    expect(specificTimeFeeNote(25)).toBe("+$25");
  });

  it("keeps cents when a fee has them", () => {
    expect(specificTimeFeeNote(12.5)).toBe("+$12.50");
  });

  it("says no charge for zero", () => {
    expect(specificTimeFeeNote(0)).toBe("No charge");
  });
});
