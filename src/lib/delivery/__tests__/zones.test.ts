import { BUSINESS_PHONE_DISPLAY } from "@/lib/site";
import {
  customFeeFor,
  fiveDigitZip,
  getDeliveryFee,
  getDeliveryZoneInfo,
  isInsideZone,
  isOutsideZone,
  resolveZipFee,
  type DeliverySettings,
} from "@/lib/delivery/zones";

const settings: DeliverySettings = {
  customFees: { "78209": 0, "78006": 75, "78163": 20 },
  insideZips: ["78209", "78210"],
  outsideZips: ["78006", "78210b"],
};

describe("fiveDigitZip", () => {
  it("keeps the first five digits of a ZIP+4", () => {
    expect(fiveDigitZip("78209-1234")).toBe("78209");
    expect(fiveDigitZip("782091234")).toBe("78209");
  });
});

describe("customFeeFor", () => {
  it("reads a plain object", () => {
    expect(customFeeFor(settings, "78006")).toBe(75);
  });

  it("reads a Mongoose Map the same way", () => {
    // A server-side caller holds the hydrated document, where `customFees` is a
    // Map. `fees["78006"]` on a Map is silently undefined, which reads as "not
    // serviced" rather than as a bug.
    const asMap = {
      customFees: new Map<string, number>([["78006", 75]]),
    } as unknown as DeliverySettings;
    expect(customFeeFor(asMap, "78006")).toBe(75);
  });

  it("returns null for an unpriced ZIP, no settings, or a NaN value", () => {
    expect(customFeeFor(settings, "78999")).toBeNull();
    expect(customFeeFor(undefined, "78209")).toBeNull();
    expect(customFeeFor({}, "78209")).toBeNull();
    expect(
      customFeeFor(
        { customFees: { "78209": Number.NaN } } as DeliverySettings,
        "78209",
      ),
    ).toBeNull();
  });
});

describe("resolveZipFee", () => {
  it("prices a ZIP from its own fee", () => {
    expect(resolveZipFee("78006", settings)).toEqual({
      fee: 75,
      source: "custom",
    });
  });

  it("treats $0 as a price, not as an absence", () => {
    expect(resolveZipFee("78209", settings)).toEqual({
      fee: 0,
      source: "custom",
    });
  });

  it("refuses a listed-but-unpriced ZIP", () => {
    // 78210 is on the inside list and has no fee. Membership is geography and
    // grants nothing.
    expect(resolveZipFee("78210", settings).source).toBe("unserviced");
  });

  it("serves a priced ZIP that is on neither list", () => {
    expect(resolveZipFee("78163", settings)).toEqual({
      fee: 20,
      source: "custom",
    });
  });

  it("accepts a ZIP+4 and refuses a short or empty ZIP", () => {
    expect(resolveZipFee("78006-1234", settings).fee).toBe(75);
    expect(resolveZipFee("780", settings).source).toBe("unserviced");
    expect(resolveZipFee("", settings).source).toBe("unserviced");
  });

  it("services nothing when no settings are supplied", () => {
    expect(resolveZipFee("78209").source).toBe("unserviced");
  });
});

describe("zone membership", () => {
  it("reports which list a ZIP is on, and nothing about its price", () => {
    expect(isInsideZone("78209", settings.insideZips)).toBe(true);
    expect(isOutsideZone("78006", settings.outsideZips)).toBe(true);
    expect(isInsideZone("78006", settings.insideZips)).toBe(false);
    expect(isInsideZone("78209", [])).toBe(false);
    expect(isOutsideZone("", settings.outsideZips)).toBe(false);
  });
});

describe("getDeliveryFee", () => {
  it("returns the ZIP's fee", () => {
    expect(getDeliveryFee("78006", settings)).toBe(75);
  });

  it("returns 0 for an unserviced ZIP so a bypassed gate cannot produce NaN", () => {
    // Not the gate. `resolveDeliveryFee` is the gate; this keeps a total finite
    // if something ever reaches here without one.
    expect(getDeliveryFee("78999", settings)).toBe(0);
  });
});

describe("getDeliveryZoneInfo", () => {
  it("describes a free inside ZIP", () => {
    const info = getDeliveryZoneInfo("78209", settings);
    expect(info).toMatchObject({
      zone: "inside",
      fee: 0,
      displayColor: "green",
    });
    expect(info.message).toBe("No distance surcharge for 78209");
  });

  it("describes a priced outside ZIP", () => {
    const info = getDeliveryZoneInfo("78006", settings);
    expect(info).toMatchObject({
      zone: "outside",
      fee: 75,
      displayColor: "orange",
    });
    expect(info.message).toBe("$75 distance surcharge for 78006");
  });

  it("reports a priced ZIP on neither list as outside", () => {
    expect(getDeliveryZoneInfo("78163", settings).zone).toBe("outside");
  });

  it("refuses an unpriced ZIP and points at the phone number", () => {
    const info = getDeliveryZoneInfo("78999", settings);
    expect(info.zone).toBe("not-supported");
    expect(info.fee).toBe(0);
    expect(info.message).toContain("78999");
    expect(info.message).toContain(BUSINESS_PHONE_DISPLAY);
  });

  it("asks for a valid ZIP before one has been typed", () => {
    expect(getDeliveryZoneInfo("782", settings).message).toBe(
      "Please enter a valid ZIP code",
    );
  });
});
