import { FEE_BUCKET_ORDER } from "@/lib/delivery/feeBuckets";
import {
  DEFAULT_TIER_MINIMUMS,
  TIER_MINIMUM_ORDER,
  formatMinimum,
  isPricedBucket,
  minimumForFee,
  minimumForZip,
  minimumOrderError,
  minimumOrderNotice,
  type TierMinimums,
} from "@/lib/delivery/tierMinimums";
import type { DeliverySettings } from "@/lib/delivery/zones";

const ladder: TierMinimums = {
  free: 100,
  low: 150,
  standard: 200,
  high: 250,
  premium: 300,
};

describe("the ladder itself", () => {
  it("ships as all zeros", () => {
    // Deliberate. bounce-v3 shipped 100/200/300/400/500 as a schema default; it
    // became policy by accident and refused 30% of a year's orders. A floor
    // nobody has measured must not start refusing bookings on deploy day.
    expect(Object.values(DEFAULT_TIER_MINIMUMS)).toEqual([0, 0, 0, 0, 0]);
  });

  it("covers exactly the legend's priced bands", () => {
    expect(TIER_MINIMUM_ORDER).toEqual(FEE_BUCKET_ORDER.filter(isPricedBucket));
    expect(Object.keys(DEFAULT_TIER_MINIMUMS).sort()).toEqual(
      [...TIER_MINIMUM_ORDER].sort(),
    );
  });
});

describe("minimumForFee", () => {
  it("maps every priced band to its configured floor", () => {
    expect(minimumForFee(0, ladder, 0)).toBe(100);
    expect(minimumForFee(20, ladder, 0)).toBe(150);
    expect(minimumForFee(50, ladder, 0)).toBe(200);
    expect(minimumForFee(75, ladder, 0)).toBe(250);
    expect(minimumForFee(150, ladder, 0)).toBe(300);
  });

  it("falls back for a fee that is not a fee", () => {
    expect(minimumForFee(null, ladder, 42)).toBe(42);
    expect(minimumForFee(undefined, ladder, 42)).toBe(42);
  });

  it("falls back to the caller's number, never to DEFAULT_TIER_MINIMUMS", () => {
    // The defaults belong to the schema. A settings object that never carried a
    // ladder must keep behaving the way it did when the only floor was global.
    expect(minimumForFee(75, undefined, 42)).toBe(42);
  });

  it("falls back per band when the ladder is partial", () => {
    expect(minimumForFee(75, { free: 100 }, 42)).toBe(42);
    expect(minimumForFee(0, { free: 100 }, 42)).toBe(100);
  });

  it("honours a configured 0 rather than reading it as absent", () => {
    expect(minimumForFee(75, { ...ladder, high: 0 }, 42)).toBe(0);
  });
});

describe("minimumForZip", () => {
  const settings: DeliverySettings = {
    customFees: { "78209": 0, "78006": 75 },
    insideZips: ["78209", "78210"],
    tierMinimums: ladder,
  };

  it("resolves through the ZIP's own fee", () => {
    expect(minimumForZip("78006", settings, 0)).toBe(250);
    expect(minimumForZip("78209", settings, 0)).toBe(100);
  });

  it("accepts a ZIP+4", () => {
    expect(minimumForZip("78006-1234", settings, 0)).toBe(250);
  });

  it("falls back for a listed-but-unpriced ZIP", () => {
    expect(minimumForZip("78210", settings, 42)).toBe(42);
  });

  it("falls back for an unknown, short, empty or absent ZIP", () => {
    expect(minimumForZip("78999", settings, 42)).toBe(42);
    expect(minimumForZip("782", settings, 42)).toBe(42);
    expect(minimumForZip("", settings, 42)).toBe(42);
    expect(minimumForZip(undefined, settings, 42)).toBe(42);
  });

  it("falls back with no settings at all", () => {
    expect(minimumForZip("78006", undefined, 42)).toBe(42);
  });
});

describe("copy", () => {
  it("formats a round figure without cents and an odd one with", () => {
    expect(formatMinimum(200)).toBe("$200");
    expect(formatMinimum(199.5)).toBe("$199.50");
  });

  it("says the floor is measured before the surcharge", () => {
    expect(minimumOrderNotice(200)).toBe(
      "Orders to this area have a $200 rental minimum, before the distance surcharge and fees.",
    );
  });

  it("names the ZIP and the shortfall in the refusal", () => {
    expect(minimumOrderError(200, "78006-1234", 149.95)).toBe(
      "Orders to 78006 have a $200 rental minimum, before the distance surcharge and fees. Your rentals come to $149.95.",
    );
  });

  it("drops the ZIP and the subtotal when it does not have them", () => {
    expect(minimumOrderError(200, undefined)).toBe(
      "Orders have a $200 rental minimum, before the distance surcharge and fees.",
    );
  });
});
