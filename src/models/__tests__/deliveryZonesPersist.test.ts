/**
 * @jest-environment node
 *
 * Everything here reads back through the **raw driver**, never through the
 * model.
 *
 * Mongoose applies schema defaults on *hydration*, so a document holding no
 * `deliveryZones` at all reads back through `Settings.findOne()` as a complete
 * one — every predicate that asks the hydrated document answers "already
 * there" while the stored document has nothing. bounce-v3 shipped a
 * self-migration built on that assumption; it did nothing, passed its tests,
 * and production ran with an empty field while the API served defaults. The
 * raw collection is the only place the difference is visible.
 *
 * This is the one suite in the repo that needs a real Mongo. Every other model
 * test is offline `doc.validate()` on purpose; do not widen the exception.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Settings } from "@/models/settings";
import { DEFAULT_TIER_MINIMUMS } from "@/lib/delivery/tierMinimums";

let mongo: MongoMemoryServer;

/** The stored document, with no model in the way. */
async function raw() {
  const collection = mongoose.connection.db?.collection("settings");
  return collection?.findOne({ key: "global" });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120_000);

afterEach(async () => {
  await mongoose.connection.db?.collection("settings").deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("deliveryZones persistence", () => {
  it("stores the whole subtree on a document created through the model", async () => {
    await Settings.create({ key: "global" });

    const stored = await raw();
    expect(stored?.deliveryZones?.insideZips).toHaveLength(99);
    expect(stored?.deliveryZones?.outsideZips).toHaveLength(21);
    expect(stored?.deliveryZones?.customFees).toEqual({});
    expect(stored?.deliveryZones?.tierMinimums).toEqual(DEFAULT_TIER_MINIMUMS);
    expect(stored?.fees?.minOrderAmount).toBe(0);
  });

  it("persists a one-band ladder edit and leaves the other bands alone", async () => {
    await Settings.create({ key: "global" });

    const doc = await Settings.findOne({ key: "global" });
    doc.deliveryZones.tierMinimums = {
      ...DEFAULT_TIER_MINIMUMS,
      ...doc.deliveryZones.tierMinimums,
      high: 250,
    };
    await doc.save();

    expect((await raw())?.deliveryZones?.tierMinimums).toEqual({
      ...DEFAULT_TIER_MINIMUMS,
      high: 250,
    });
  });

  it("stores a band edited back to 0 rather than dropping the field", async () => {
    // A configured 0 is a real setting — "no floor for this band" — and must be
    // distinguishable from a band nobody has configured, which falls back.
    await Settings.create({
      key: "global",
      deliveryZones: { tierMinimums: { ...DEFAULT_TIER_MINIMUMS, high: 250 } },
    });

    const doc = await Settings.findOne({ key: "global" });
    doc.deliveryZones.tierMinimums = {
      ...doc.deliveryZones.tierMinimums,
      high: 0,
    };
    await doc.save();

    const stored = await raw();
    expect(stored?.deliveryZones?.tierMinimums).toHaveProperty("high", 0);
  });

  it("writes one ZIP's fee without disturbing the others", async () => {
    // The clobber regression, at the storage layer: `customFees` is a wholesale
    // assignment, so a writer that rebuilds the map reverts every fee written
    // since it last read.
    await Settings.create({
      key: "global",
      deliveryZones: { customFees: { "78209": 0, "78006": 75 } },
    });

    const doc = await Settings.findOne({ key: "global" });
    doc.deliveryZones.customFees.set("78163", 25);
    doc.markModified("deliveryZones.customFees");
    await doc.save();

    expect((await raw())?.deliveryZones?.customFees).toEqual({
      "78209": 0,
      "78006": 75,
      "78163": 25,
    });
  });

  it("deletes a removed ZIP's key rather than storing a zero", async () => {
    await Settings.create({
      key: "global",
      deliveryZones: { customFees: { "78209": 0, "78006": 75 } },
    });

    const doc = await Settings.findOne({ key: "global" });
    doc.deliveryZones.customFees.delete("78006");
    doc.markModified("deliveryZones.customFees");
    await doc.save();

    const fees = (await raw())?.deliveryZones?.customFees;
    expect(fees).toEqual({ "78209": 0 });
    expect(fees).not.toHaveProperty("78006");
  });

  it("keeps an emptied zone list empty rather than re-seeding it", async () => {
    // Membership is geography and grants no price, so an empty zone is a state
    // the admin is entitled to save.
    await Settings.create({ key: "global" });

    const doc = await Settings.findOne({ key: "global" });
    doc.deliveryZones.insideZips = [];
    await doc.save();

    const stored = await raw();
    expect(stored?.deliveryZones?.insideZips).toEqual([]);
    expect(stored?.deliveryZones?.outsideZips).toHaveLength(21);
  });
});
