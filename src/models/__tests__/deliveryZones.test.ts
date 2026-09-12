/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { Settings } from "@/models/settings";
import {
  DEFAULT_INSIDE_ZIPS,
  DEFAULT_OUTSIDE_ZIPS,
} from "@/lib/delivery/defaultZones";
import { DEFAULT_TIER_MINIMUMS } from "@/lib/delivery/tierMinimums";
import { DEFAULT_BASE_DELIVERY_FEE } from "@/lib/delivery/deliveryCharge";

describe("deliveryZones schema", () => {
  it("starts a fresh document with the seeded geography and an empty fee map", () => {
    const doc = new Settings({});
    expect(doc.deliveryZones.insideZips).toEqual(DEFAULT_INSIDE_ZIPS);
    expect(doc.deliveryZones.outsideZips).toEqual(DEFAULT_OUTSIDE_ZIPS);
    // Listed is not priced. A brand-new document services nothing until the
    // seed script gives each ZIP a fee.
    expect(doc.deliveryZones.customFees.size).toBe(0);
  });

  it("starts the ladder at zero, so nothing is refused before it is configured", () => {
    const doc = new Settings({});
    const stored = doc.deliveryZones.tierMinimums;
    for (const [tier, value] of Object.entries(DEFAULT_TIER_MINIMUMS)) {
      expect(stored[tier as keyof typeof DEFAULT_TIER_MINIMUMS]).toBe(value);
    }
    expect(doc.fees.minOrderAmount).toBe(0);
  });

  it("starts with the base delivery fee, so a $0 ZIP is not free delivery", () => {
    // Unlike `tierMinimums` this is not seeded and not self-migrated: one
    // scalar whose default *is* the policy. A document that has never carried
    // it reads the current price.
    expect(new Settings({}).deliveryZones.baseFee).toBe(
      DEFAULT_BASE_DELIVERY_FEE,
    );
  });

  it("stores a base fee of 0, which is a choice and not an absence", async () => {
    const doc = new Settings({ deliveryZones: { baseFee: 0 } });
    await doc.validate();
    expect(doc.deliveryZones.baseFee).toBe(0);
  });

  it("stores customFees as a Map keyed by ZIP", () => {
    const doc = new Settings({
      deliveryZones: { customFees: { "78209": 0, "78006": 75 } },
    });
    expect(doc.deliveryZones.customFees.get("78006")).toBe(75);
    expect(doc.deliveryZones.customFees.get("78209")).toBe(0);
  });

  it("refuses a negative fee and a negative tier minimum", async () => {
    const negativeFee = new Settings({
      deliveryZones: { customFees: { "78006": -5 } },
    });
    await expect(negativeFee.validate()).rejects.toThrow();

    const negativeTier = new Settings({
      deliveryZones: { tierMinimums: { high: -1 } },
    });
    await expect(negativeTier.validate()).rejects.toThrow();

    const negativeBase = new Settings({ deliveryZones: { baseFee: -1 } });
    await expect(negativeBase.validate()).rejects.toThrow();
  });

  it("survives JSON serialisation with its fees intact", () => {
    // `JSON.stringify` renders a Mongoose Map as `{}`. Without
    // `flattenMaps` in `getPublicSettings`, the public fee map reaches the
    // browser empty and every ZIP reads as unserviced while the server prices
    // them correctly — the two sides of the wire disagreeing in silence.
    const doc = new Settings({
      deliveryZones: { customFees: { "78006": 75 } },
    });

    const naive = JSON.parse(JSON.stringify(doc.toObject()));
    expect(naive.deliveryZones.customFees).toEqual({});

    const flattened = JSON.parse(
      JSON.stringify(doc.toObject({ flattenMaps: true })),
    );
    expect(flattened.deliveryZones.customFees).toEqual({ "78006": 75 });
  });
});
