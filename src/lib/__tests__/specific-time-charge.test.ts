import {
  DEFAULT_SPECIFIC_TIME_FEE,
  formatLegTime,
  legPreference,
  resolveSpecificTimeCharge,
  specificTimeFeeNote,
} from "@/lib/specific-time-charge";

const fees = {
  specificDeliveryTimeFee: DEFAULT_SPECIFIC_TIME_FEE,
  specificPickupTimeFee: DEFAULT_SPECIFIC_TIME_FEE,
};

describe("legPreference", () => {
  it("returns a stored preference whatever the time says", () => {
    expect(legPreference("10:00", "flexible")).toBe("flexible");
    expect(legPreference("10:00", "specific")).toBe("specific");
  });

  describe("a legacy order with no stored preference", () => {
    it("reads ANY as flexible", () => {
      expect(legPreference("ANY", undefined)).toBe("flexible");
    });

    it("reads a clock time as specific, which is how it was priced", () => {
      expect(legPreference("10:00", undefined)).toBe("specific");
    });

    it("reads an empty value as flexible, so a half-filled form is never billed", () => {
      expect(legPreference("", undefined)).toBe("flexible");
      expect(legPreference(undefined, null)).toBe("flexible");
    });
  });

  it("ignores a preference that is not one of the two", () => {
    expect(legPreference("10:00", "any")).toBe("specific");
  });
});

describe("resolveSpecificTimeCharge", () => {
  const both = (
    rentalTimePreference: "flexible" | "specific",
    returnTimePreference: "flexible" | "specific",
  ) => ({
    rentalTime: "10:00",
    returnTime: "16:00",
    rentalTimePreference,
    returnTimePreference,
  });

  it("charges nothing when both legs are flexible, though both name a time", () => {
    expect(
      resolveSpecificTimeCharge({ ...both("flexible", "flexible"), ...fees }),
    ).toBe(0);
  });

  it("charges the delivery fee alone for a specific delivery", () => {
    expect(
      resolveSpecificTimeCharge({ ...both("specific", "flexible"), ...fees }),
    ).toBe(DEFAULT_SPECIFIC_TIME_FEE);
  });

  it("charges the pickup fee alone for a specific pickup", () => {
    expect(
      resolveSpecificTimeCharge({
        ...both("flexible", "specific"),
        specificDeliveryTimeFee: 7,
        specificPickupTimeFee: 11,
      }),
    ).toBe(11);
  });

  it("sums both legs when both are specific", () => {
    expect(
      resolveSpecificTimeCharge({ ...both("specific", "specific"), ...fees }),
    ).toBe(DEFAULT_SPECIFIC_TIME_FEE * 2);
  });

  it("honours a fee of zero", () => {
    expect(
      resolveSpecificTimeCharge({
        ...both("specific", "specific"),
        specificDeliveryTimeFee: 0,
        specificPickupTimeFee: 0,
      }),
    ).toBe(0);
  });

  it("prices a legacy order from its times", () => {
    expect(
      resolveSpecificTimeCharge({
        rentalTime: "10:00",
        returnTime: "ANY",
        rentalTimePreference: undefined,
        returnTimePreference: undefined,
        ...fees,
      }),
    ).toBe(DEFAULT_SPECIFIC_TIME_FEE);
  });

  it("ships at $25 per leg", () => {
    expect(DEFAULT_SPECIFIC_TIME_FEE).toBe(25);
  });
});

describe("formatLegTime", () => {
  it("promises a flexible delivery at or before the time", () => {
    expect(formatLegTime("delivery", "14:00", "flexible")).toBe("by 2:00 PM");
  });

  it("promises a flexible pickup at or after the time", () => {
    expect(formatLegTime("pickup", "18:00", "flexible")).toBe("from 6:00 PM");
  });

  it("promises a specific leg exactly then", () => {
    expect(formatLegTime("delivery", "09:00", "specific")).toBe("at 9:00 AM");
    expect(formatLegTime("pickup", "12:00", "specific")).toBe("at 12:00 PM");
  });

  it("reads a legacy ANY leg as Any Time", () => {
    expect(formatLegTime("pickup", "ANY", undefined)).toBe("Any Time");
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
