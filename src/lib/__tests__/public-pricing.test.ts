import { publicPriceTable, offerPriceValidUntil } from "@/lib/pricing";
import { machinePackages, mixerDetails } from "@/lib/rental-data";

// /pricing, /order and /service-area/[city] built their visible tables and
// their Offer nodes from the rental-data constants while the order wizard and
// /api/save-booking priced from Settings, so an admin price change left the
// public pages, the structured data and the invoice disagreeing.
describe("publicPriceTable", () => {
  it("falls back to the rental-data constants with no overrides", () => {
    const table = publicPriceTable();

    expect(table.machineBasePrice("single")).toBe(
      machinePackages.find((p) => p.type === "single")!.basePrice,
    );
    expect(table.mixerPrice("margarita")).toBe(mixerDetails.margarita.price);
  });

  it("prefers a Settings override over the constant", () => {
    const table = publicPriceTable({
      machines: { single: { basePrice: 149.95 } },
      mixers: { margarita: { price: 24.95 } },
    });

    expect(table.machineBasePrice("single")).toBe(149.95);
    expect(table.mixerPrice("margarita")).toBe(24.95);
  });

  // Settings.mixers and .machines are Mixed maps, so Mongoose does not
  // type-check them and a legacy document can hold a string or null.
  it.each([
    ["a string", "19.95"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", NaN],
  ])("ignores %s in an override and uses the constant", (_label, value) => {
    const table = publicPriceTable({
      machines: { single: { basePrice: value as number } },
      mixers: { margarita: { price: value as number } },
    });

    expect(table.machineBasePrice("single")).toBe(
      machinePackages.find((p) => p.type === "single")!.basePrice,
    );
    expect(table.mixerPrice("margarita")).toBe(mixerDetails.margarita.price);
  });

  it("returns the id itself for an unknown mixer label", () => {
    expect(publicPriceTable().mixerLabel("blue-hawaiian")).toBe(
      "blue-hawaiian",
    );
  });
});

describe("offerPriceValidUntil", () => {
  // Google treats an Offer with no priceValidUntil as potentially stale and
  // may suppress the rich result.
  it("is a future YYYY-MM-DD date", () => {
    const value = offerPriceValidUntil();

    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(value + "T00:00:00Z").getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});
