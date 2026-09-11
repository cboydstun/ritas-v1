import {
  UNSERVICED_ZIP_CODE,
  resolveDeliveryFee,
} from "@/lib/delivery/resolveDeliveryFee";
import type { DeliverySettings } from "@/lib/delivery/zones";

const settings: DeliverySettings = {
  customFees: { "78209": 0, "78006": 75 },
  insideZips: ["78209", "78210"],
};

describe("resolveDeliveryFee", () => {
  it("resolves a priced ZIP to its own fee", () => {
    expect(resolveDeliveryFee("78006", settings)).toEqual({
      ok: true,
      fee: 75,
    });
  });

  it("resolves a $0 ZIP to 0 rather than refusing it", () => {
    expect(resolveDeliveryFee("78209", settings)).toEqual({ ok: true, fee: 0 });
  });

  it("refuses an unpriced ZIP instead of delivering there free", () => {
    // `getDeliveryFee`'s `?? 0` would have priced this at nothing. Refusing is
    // the point: nobody set a price, so nobody agreed to drive there.
    const result = resolveDeliveryFee("78999", settings);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.code).toBe(UNSERVICED_ZIP_CODE);
    expect(result.error).toMatch(/\(512\) 210-0194/);
  });

  it("refuses a listed-but-unpriced ZIP", () => {
    expect(resolveDeliveryFee("78210", settings).ok).toBe(false);
  });

  it("refuses a missing ZIP", () => {
    expect(resolveDeliveryFee(undefined, settings).ok).toBe(false);
    expect(resolveDeliveryFee(null, settings).ok).toBe(false);
    expect(resolveDeliveryFee("", settings).ok).toBe(false);
  });

  it("refuses everything when no settings are configured", () => {
    expect(resolveDeliveryFee("78006", undefined).ok).toBe(false);
  });
});
