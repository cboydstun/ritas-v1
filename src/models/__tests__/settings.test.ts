/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { Settings } from "@/models/settings";

describe("Settings Model", () => {
  describe("Schema defaults", () => {
    it("applies default key: global when omitted", () => {
      const doc = new Settings({});
      expect(doc.key).toBe("global");
    });

    it("applies default fee values when fees are omitted", () => {
      const doc = new Settings({});
      expect(doc.fees.deliveryFee).toBe(20);
      expect(doc.fees.salesTaxRate).toBe(0.0825);
      expect(doc.fees.processingFeeRate).toBe(0.03);
      expect(doc.fees.serviceDiscountRate).toBe(0.1);
    });

    it("applies default machine base prices when machines are omitted", () => {
      const doc = new Settings({});
      expect(doc.machines.single.basePrice).toBe(124.95);
      expect(doc.machines.double.basePrice).toBe(149.95);
      expect(doc.machines.triple.basePrice).toBe(175.95);
    });

    it("applies default mixer prices when mixers are omitted", () => {
      const doc = new Settings({});
      expect(doc.mixers["non-alcoholic"].price).toBe(19.95);
      expect(doc.mixers["margarita"].price).toBe(19.95);
      expect(doc.mixers["pina-colada"].price).toBe(24.95);
      expect(doc.mixers["strawberry-daiquiri"].price).toBe(24.95);
    });

    it("applies default extras prices when extras are omitted", () => {
      const doc = new Settings({});
      expect(doc.extras["table-chairs"].price).toBe(19.95);
      expect(doc.extras["cotton-candy"].price).toBe(49.95);
      expect(doc.extras["bounce-castle"].price).toBe(99.95);
      expect(doc.extras["popcorn-machine"].price).toBe(49.95);
    });

    it("applies default delivery window hours when operations are omitted", () => {
      const doc = new Settings({});
      expect(doc.operations.deliveryWindowStartHour).toBe(8);
      expect(doc.operations.deliveryWindowEndHour).toBe(18);
    });
  });

  describe("Fee validators", () => {
    it("rejects negative deliveryFee", () => {
      const doc = new Settings({ fees: { deliveryFee: -1 } });
      const errors = doc.validateSync();
      expect(errors?.errors["fees.deliveryFee"]).toBeDefined();
    });

    it("rejects negative salesTaxRate", () => {
      const doc = new Settings({ fees: { salesTaxRate: -0.1 } });
      const errors = doc.validateSync();
      expect(errors?.errors["fees.salesTaxRate"]).toBeDefined();
    });

    it("rejects salesTaxRate > 1", () => {
      const doc = new Settings({ fees: { salesTaxRate: 1.5 } });
      const errors = doc.validateSync();
      expect(errors?.errors["fees.salesTaxRate"]).toBeDefined();
    });

    it("accepts valid fee values", () => {
      const doc = new Settings({
        fees: { deliveryFee: 30, salesTaxRate: 0.09 },
      });
      const errors = doc.validateSync();
      expect(errors).toBeUndefined();
    });
  });

  describe("Operations validators", () => {
    it("rejects deliveryWindowStartHour >= deliveryWindowEndHour", async () => {
      const doc = new Settings({
        operations: { deliveryWindowStartHour: 18, deliveryWindowEndHour: 8 },
      });
      await expect(doc.validate()).rejects.toThrow();
    });

    it("rejects equal deliveryWindowStartHour and deliveryWindowEndHour", async () => {
      const doc = new Settings({
        operations: { deliveryWindowStartHour: 12, deliveryWindowEndHour: 12 },
      });
      await expect(doc.validate()).rejects.toThrow();
    });

    it("accepts valid delivery window", async () => {
      const doc = new Settings({
        operations: { deliveryWindowStartHour: 9, deliveryWindowEndHour: 17 },
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });
  });

  describe("Singleton key", () => {
    it("model uses singleton key: global by default", () => {
      const doc = new Settings({});
      expect(doc.key).toBe("global");
    });

    it("key field can be set to global explicitly", () => {
      const doc = new Settings({ key: "global" });
      expect(doc.key).toBe("global");
    });
  });
});
