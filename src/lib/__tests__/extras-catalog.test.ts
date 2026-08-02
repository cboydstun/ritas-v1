import {
  MAX_EXTRA_QUANTITY,
  buildExtrasCatalog,
  resolveSelectedExtras,
} from "@/lib/extras-catalog";

describe("extras catalog", () => {
  describe("buildExtrasCatalog", () => {
    it("includes the static extras and one entry per mixer flavour", () => {
      const catalog = buildExtrasCatalog();

      expect(catalog.get("table-chairs")?.price).toBe(19.95);
      expect(catalog.get("popcorn-machine")?.price).toBe(49.95);
      expect(catalog.get("mixer-margarita")?.price).toBe(19.95);
      expect(catalog.get("mixer-pina-colada")?.price).toBe(24.95);
    });

    it("prices extra mixers as flat, not per-day", () => {
      expect(buildExtrasCatalog().get("mixer-margarita")?.pricingType).toBe(
        "flat",
      );
    });

    it("applies admin price overrides", () => {
      const catalog = buildExtrasCatalog({
        extras: { "table-chairs": { price: 30 } },
        mixers: { margarita: { price: 5 } },
      });

      expect(catalog.get("table-chairs")?.price).toBe(30);
      expect(catalog.get("mixer-margarita")?.price).toBe(5);
    });

    it("prefers an explicit extras override over the mixer price", () => {
      const catalog = buildExtrasCatalog({
        extras: { "mixer-margarita": { price: 7 } },
        mixers: { margarita: { price: 5 } },
      });

      expect(catalog.get("mixer-margarita")?.price).toBe(7);
    });
  });

  describe("resolveSelectedExtras", () => {
    it("ignores a price supplied by the caller", () => {
      const { extras } = resolveSelectedExtras([
        { id: "table-chairs", price: -500, name: "Free stuff" },
      ]);

      expect(extras).toHaveLength(1);
      expect(extras[0].price).toBe(19.95);
      expect(extras[0].name).toBe("Table & Chairs Set");
    });

    it("ignores a pricingType supplied by the caller", () => {
      const { extras } = resolveSelectedExtras([
        { id: "mixer-margarita", pricingType: "per-day" },
      ]);

      expect(extras[0].pricingType).toBe("flat");
    });

    it("reports unknown ids instead of pricing them", () => {
      const { extras, unknownIds } = resolveSelectedExtras([
        { id: "not-a-real-extra", price: 1000 },
        { id: "table-chairs" },
      ]);

      expect(unknownIds).toEqual(["not-a-real-extra"]);
      expect(extras.map((e) => e.id)).toEqual(["table-chairs"]);
    });

    it("clamps quantity to the allowed range", () => {
      const { extras } = resolveSelectedExtras([
        { id: "table-chairs", quantity: 9999 },
      ]);

      expect(extras[0].quantity).toBe(MAX_EXTRA_QUANTITY);
    });

    it("rejects zero, negative and non-numeric quantities", () => {
      for (const quantity of [0, -5, "many", null, NaN]) {
        const { extras } = resolveSelectedExtras([
          { id: "table-chairs", quantity },
        ]);
        expect(extras[0].quantity).toBe(1);
      }
    });

    it("forces quantity to 1 for items that do not allow one", () => {
      const { extras } = resolveSelectedExtras([
        { id: "cotton-candy", quantity: 10 },
      ]);

      expect(extras[0].quantity).toBe(1);
    });

    it("collapses duplicate ids so they are not billed twice", () => {
      const { extras } = resolveSelectedExtras([
        { id: "table-chairs" },
        { id: "table-chairs" },
      ]);

      expect(extras).toHaveLength(1);
    });

    it("tolerates a non-array payload", () => {
      expect(resolveSelectedExtras(null).extras).toEqual([]);
      expect(resolveSelectedExtras("nope").extras).toEqual([]);
      expect(resolveSelectedExtras({ id: "table-chairs" }).extras).toEqual([]);
    });

    it("skips entries that are not objects or have no string id", () => {
      const { extras } = resolveSelectedExtras([
        null,
        "table-chairs",
        { id: 42 },
        { id: "table-chairs" },
      ]);

      expect(extras.map((e) => e.id)).toEqual(["table-chairs"]);
    });
  });
});
