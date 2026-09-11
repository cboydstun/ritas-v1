import {
  buildZipFeeRows,
  bucketsInUse,
  configuredZipCodes,
  countByBucket,
} from "@/lib/delivery/zipFeeRows";
import type { DeliverySettings } from "@/lib/delivery/zones";

const settings: DeliverySettings = {
  customFees: { "78209": 0, "78006": 75, "78163": 20 },
  insideZips: ["78209", "78210"],
  outsideZips: ["78006"],
};

describe("configuredZipCodes", () => {
  it("unions the fee map with both zone lists, sorted and deduplicated", () => {
    expect(configuredZipCodes(settings)).toEqual([
      "78006",
      "78163",
      "78209",
      "78210",
    ]);
  });

  it("reads a Mongoose Map of fees", () => {
    const asMap = {
      customFees: new Map<string, number>([["78006", 75]]),
    } as unknown as DeliverySettings;
    expect(configuredZipCodes(asMap)).toEqual(["78006"]);
  });

  it("returns nothing for empty settings", () => {
    expect(configuredZipCodes({})).toEqual([]);
  });
});

describe("buildZipFeeRows", () => {
  it("keeps a listed ZIP with no fee, so the gap is visible", () => {
    // 78210 is listed and unpriced: checkout refuses it. Dropping it from the
    // admin's view is how that state stays invisible.
    const row = buildZipFeeRows(settings).find((r) => r.zipCode === "78210");
    expect(row).toMatchObject({ fee: null });
    expect(row?.bucket.id).toBe("unserviced");
  });

  it("keeps a priced ZIP that is on neither list", () => {
    const row = buildZipFeeRows(settings).find((r) => r.zipCode === "78163");
    expect(row).toMatchObject({ fee: 20 });
    expect(row?.bucket.id).toBe("low");
  });

  it("bands each ZIP by its own fee", () => {
    const byZip = Object.fromEntries(
      buildZipFeeRows(settings).map((r) => [r.zipCode, r.bucket.id]),
    );
    expect(byZip).toEqual({
      "78006": "high",
      "78163": "low",
      "78209": "free",
      "78210": "unserviced",
    });
  });
});

describe("legend helpers", () => {
  it("reports only the bands in use", () => {
    expect(bucketsInUse(buildZipFeeRows(settings))).toEqual(
      new Set(["free", "low", "high", "unserviced"]),
    );
  });

  it("counts the ZIPs in each band", () => {
    expect(countByBucket(buildZipFeeRows(settings))).toEqual({
      free: 1,
      low: 1,
      high: 1,
      unserviced: 1,
    });
  });
});
