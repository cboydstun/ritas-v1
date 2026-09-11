import {
  DEFAULT_INSIDE_ZIPS,
  DEFAULT_OUTSIDE_ZIPS,
  DEFAULT_SERVICED_ZIPS,
  SEED_FLAT_FEE,
} from "@/lib/delivery/defaultZones";

describe("DEFAULT_INSIDE_ZIPS", () => {
  it("runs 78201 to 78299 inclusive", () => {
    // The generator this replaces ran `i = 0` and produced 78200-78298: it
    // turned away the real ZIP 78299 and accepted the unassigned 78200. An
    // off-by-one here is invisible until a customer is refused.
    expect(DEFAULT_INSIDE_ZIPS).toHaveLength(99);
    expect(DEFAULT_INSIDE_ZIPS[0]).toBe("78201");
    expect(DEFAULT_INSIDE_ZIPS.at(-1)).toBe("78299");
    expect(DEFAULT_INSIDE_ZIPS).not.toContain("78200");
  });

  it("holds five-digit strings only", () => {
    for (const zip of DEFAULT_SERVICED_ZIPS) expect(zip).toMatch(/^\d{5}$/);
  });
});

describe("the seeded service area", () => {
  it("matches what the old hardcoded gate accepted", () => {
    expect(DEFAULT_OUTSIDE_ZIPS).toHaveLength(21);
    expect(DEFAULT_SERVICED_ZIPS).toHaveLength(120);
    expect(new Set(DEFAULT_SERVICED_ZIPS).size).toBe(120);
  });

  it("puts no ZIP on both lists", () => {
    const inside = new Set(DEFAULT_INSIDE_ZIPS);
    expect(DEFAULT_OUTSIDE_ZIPS.filter((z) => inside.has(z))).toEqual([]);
  });

  it("seeds at the flat fee this system replaces", () => {
    // Day-one pricing is identical to the flat $20; retuning happens in the
    // admin afterwards, one ZIP at a time.
    expect(SEED_FLAT_FEE).toBe(20);
  });
});
