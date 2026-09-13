import {
  DEFAULT_INSIDE_ZIPS,
  DEFAULT_OUTSIDE_ZIPS,
  DEFAULT_SERVICED_ZIPS,
  DEFAULT_ZIP_FEES,
} from "@/lib/delivery/defaultZones";
import { DEFAULT_TIER_MINIMUMS } from "@/lib/delivery/tierMinimums";

/**
 * These assert invariants over the snapshot rather than restating its numbers,
 * so re-copying bounce-v3's table cannot silently drift past the suite. The one
 * thing pinned by value is the set of ritas-only ZIPs, because those are the
 * ones a re-copy would quietly drop.
 */
describe("the seeded service area", () => {
  it("holds five-digit strings only", () => {
    for (const zip of DEFAULT_SERVICED_ZIPS) expect(zip).toMatch(/^\d{5}$/);
    for (const zip of Object.keys(DEFAULT_ZIP_FEES))
      expect(zip).toMatch(/^\d{5}$/);
  });

  it("puts no ZIP on both lists", () => {
    const inside = new Set(DEFAULT_INSIDE_ZIPS);
    expect(DEFAULT_OUTSIDE_ZIPS.filter((z) => inside.has(z))).toEqual([]);
    expect(new Set(DEFAULT_SERVICED_ZIPS).size).toBe(
      DEFAULT_SERVICED_ZIPS.length,
    );
  });

  it("prices every listed ZIP", () => {
    // A listed ZIP with no fee reads as covered on the admin map and is refused
    // at checkout. `unpricedListedZips` exists to surface that state; the seed
    // must never be born in it.
    const unpriced = DEFAULT_SERVICED_ZIPS.filter(
      (zip) => typeof DEFAULT_ZIP_FEES[zip] !== "number",
    );
    expect(unpriced).toEqual([]);
  });

  it("lists every priced ZIP", () => {
    // The mirror: priced means serviced whatever the lists say, so a fee with no
    // list entry is a ZIP delivered to that neither zone's copy mentions.
    const listed = new Set(DEFAULT_SERVICED_ZIPS);
    const unlisted = Object.keys(DEFAULT_ZIP_FEES).filter(
      (zip) => !listed.has(zip),
    );
    expect(unlisted).toEqual([]);
  });

  it("charges nothing negative", () => {
    for (const fee of Object.values(DEFAULT_ZIP_FEES))
      expect(fee).toBeGreaterThanOrEqual(0);
  });
});

describe("the ZIPs that reached bounce-v3's table late", () => {
  // These seven were on neither of bounce-v3's zone lists when this snapshot was
  // read, so they are the ones a re-copy would quietly drop — which starts
  // refusing a customer who was being served yesterday, and no other test in
  // this suite would notice.
  const LATE_ARRIVALS = [
    "78039",
    "78052",
    "78054",
    "78056",
    "78069",
    "78112",
    "78150",
  ];

  it.each(LATE_ARRIVALS)("still serves %s", (zip) => {
    expect(DEFAULT_OUTSIDE_ZIPS).toContain(zip);
    expect(typeof DEFAULT_ZIP_FEES[zip]).toBe("number");
  });

  it("charges bounce-v3's own price for all seven", () => {
    // 78039, 78056 and 78112 were priced in bounce-v3 without being listed, so
    // they carried a real figure from the first copy. The other four had none:
    // this snapshot was read 37 minutes before bounce-v3 priced them by nearest
    // neighbour, and they held ritas' previous flat $20 until the 2026-09-12
    // reconcile. Same depot, same drive, same price.
    expect({
      "78039": DEFAULT_ZIP_FEES["78039"],
      "78052": DEFAULT_ZIP_FEES["78052"],
      "78054": DEFAULT_ZIP_FEES["78054"],
      "78056": DEFAULT_ZIP_FEES["78056"],
      "78069": DEFAULT_ZIP_FEES["78069"],
      "78112": DEFAULT_ZIP_FEES["78112"],
      "78150": DEFAULT_ZIP_FEES["78150"],
    }).toEqual({
      "78039": 100,
      "78052": 100,
      "78054": 50,
      "78056": 100,
      "78069": 100,
      "78112": 100,
      "78150": 25,
    });
  });
});

describe("tier minimums", () => {
  it("stays at zero after the import", () => {
    // bounce-v3 runs a 100/200/300/400/500 ladder against bounce-house order
    // sizes. Copying its fees is not a reason to copy its floors.
    expect(DEFAULT_TIER_MINIMUMS).toEqual({
      free: 0,
      low: 0,
      standard: 0,
      high: 0,
      premium: 0,
    });
  });
});
