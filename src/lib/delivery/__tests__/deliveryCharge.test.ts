/**
 * The two-term delivery charge.
 *
 * These assert the rule itself; `rentalSubtotalMirror.test.ts` asserts that
 * `computeOrderTotal` applies it, and that the browser and the server therefore
 * reach the same number. Both matter: the price guard cannot catch a
 * disagreement about delivery, because `/api/save-booking` recomputes the whole
 * total rather than comparing line items.
 */
import {
  DEFAULT_BASE_DELIVERY_FEE,
  NO_DELIVERY_CHARGE,
  deliveryChargeFor,
} from "../deliveryCharge";

describe("deliveryChargeFor", () => {
  it("adds the base fee to the ZIP's surcharge", () => {
    expect(deliveryChargeFor({ distanceSurcharge: 75, baseFee: 20 })).toEqual({
      baseFee: 20,
      distanceSurcharge: 75,
      total: 95,
    });
  });

  it("charges the base fee where there is no surcharge", () => {
    // The failure the base term exists to fix: 25 seeded ZIPs are priced at $0,
    // and each of them used to buy a truck, two people and a round trip for
    // nothing.
    expect(deliveryChargeFor({ distanceSurcharge: 0, baseFee: 20 })).toEqual({
      baseFee: 20,
      distanceSurcharge: 0,
      total: 20,
    });
  });

  it("charges the surcharge alone when the base fee is zero", () => {
    // A legal admin choice, and distinguishable from "never configured".
    const charge = deliveryChargeFor({ distanceSurcharge: 50, baseFee: 0 });
    expect(charge.baseFee).toBe(0);
    expect(charge.total).toBe(50);
  });

  it("reads the current default when no base fee is stored", () => {
    // A document written before the field existed must read the current price,
    // not free delivery. `undefined` and `0` are different answers.
    const charge = deliveryChargeFor({
      distanceSurcharge: 0,
      baseFee: undefined,
    });
    expect(charge.baseFee).toBe(DEFAULT_BASE_DELIVERY_FEE);
    expect(charge.total).toBe(DEFAULT_BASE_DELIVERY_FEE);
  });

  it("never bills a negative base fee", () => {
    expect(
      deliveryChargeFor({ distanceSurcharge: 25, baseFee: -100 }).total,
    ).toBe(25);
  });

  it("rounds decimal half-up, like every other money figure", () => {
    // Through the shared `roundCurrency`, not `toFixed` — which rounds the
    // binary double and loses the half-cent.
    const charge = deliveryChargeFor({
      distanceSurcharge: 10.005,
      baseFee: 0,
    });
    expect(charge.total).toBe(10.01);
  });

  it("is zero before a ZIP is known", () => {
    expect(NO_DELIVERY_CHARGE.total).toBe(0);
    expect(NO_DELIVERY_CHARGE.baseFee).toBe(0);
  });

  it("defaults to what delivery cost before per-ZIP pricing shipped", () => {
    // $20 flat is what every order paid, and what `fees.deliveryFee` still
    // defaults to. Keep the two in step.
    expect(DEFAULT_BASE_DELIVERY_FEE).toBe(20);
  });
});
