/**
 * The browser and the server must agree on the rental subtotal to the cent.
 *
 * It is the figure the order minimum is measured against, on both sides of the
 * wire: the review step decides whether to let someone continue, and
 * `/api/save-booking` decides whether to accept what they submitted. A cent of
 * drift refuses at the API what the review screen had already approved —
 * identically on every retry, with no way for the customer to get past it.
 *
 * There is only one implementation (`computeOrderTotal`), which is the point;
 * this suite pins the property that keeps it safe to have only one — that the
 * subtotal excludes delivery entirely, both the distance surcharge and the flat
 * base fee, so the two sides cannot diverge by resolving a ZIP differently.
 */
import { computeOrderTotal, type SettingsOverrides } from "../utils";
import { DEFAULT_BASE_DELIVERY_FEE } from "@/lib/delivery/deliveryCharge";
import type { OrderFormData } from "../types";

const settings: SettingsOverrides = {
  deliveryZones: {
    customFees: { "78205": 0, "78015": 75, "78006": 25 },
    insideZips: ["78205"],
    outsideZips: ["78015", "78006"],
    // Stated rather than left to the schema default, so a change to that
    // default cannot quietly move what these cases assert.
    baseFee: 20,
  },
};

const cart = (
  overrides: Partial<OrderFormData> = {},
  zipCode = "78205",
): OrderFormData =>
  ({
    machineType: "double",
    capacity: 30,
    selectedMixers: ["margarita", "pina-colada"],
    selectedExtras: [],
    price: 0,
    rentalDate: "2026-06-01",
    rentalTime: "12:00",
    returnDate: "2026-06-02",
    returnTime: "12:00",
    customer: {
      name: "Sam Rivera",
      email: "sam@example.com",
      phone: "(210) 555-0134",
      address: {
        street: "1 Alamo Plaza",
        city: "San Antonio",
        state: "TX",
        zipCode,
      },
    },
    notes: "",
    isServiceDiscount: false,
    ...overrides,
  }) as OrderFormData;

const CARTS: [string, OrderFormData][] = [
  ["single day", cart()],
  ["multi-day", cart({ returnDate: "2026-06-04" })],
  [
    "a per-day extra",
    cart({
      selectedExtras: [{ id: "table-chairs", name: "", price: 0 }] as never,
    }),
  ],
  [
    "a flat-priced extra",
    cart({
      returnDate: "2026-06-04",
      selectedExtras: [{ id: "cotton-candy", name: "", price: 0 }] as never,
    }),
  ],
];

describe("rentalSubtotal excludes the distance surcharge", () => {
  it.each(CARTS)(
    "%s: the same cart costs the same to rent anywhere",
    (_label, base) => {
      const free = computeOrderTotal(base, settings);
      const mid = computeOrderTotal(
        {
          ...base,
          customer: {
            ...base.customer,
            address: { ...base.customer.address, zipCode: "78006" },
          },
        },
        settings,
      );
      const far = computeOrderTotal(
        {
          ...base,
          customer: {
            ...base.customer,
            address: { ...base.customer.address, zipCode: "78015" },
          },
        },
        settings,
      );

      expect(mid.rentalSubtotal).toBe(free.rentalSubtotal);
      expect(far.rentalSubtotal).toBe(free.rentalSubtotal);
    },
  );

  it.each(CARTS)(
    "%s: subtotal is exactly rentalSubtotal plus the whole delivery charge and the time charge",
    (_label, base) => {
      const far = computeOrderTotal(
        {
          ...base,
          customer: {
            ...base.customer,
            address: { ...base.customer.address, zipCode: "78015" },
          },
        },
        settings,
      );

      // Both terms: the ZIP's $75 surcharge and the $20 base every order pays.
      expect(far.distanceSurcharge).toBe(75);
      expect(far.deliveryBaseFee).toBe(20);
      expect(far.deliveryFee).toBe(95);
      // Both legs are pinned to 12:00, so the $25-per-leg specific-time
      // charge is the third term — and, like the surcharge, it sits outside
      // rentalSubtotal.
      expect(far.specificTimeCharge).toBe(50);
      expect(far.subtotal).toBeCloseTo(far.rentalSubtotal + 95 + 50, 2);
    },
  );
});

describe("the surcharge is resolved from the cart's own ZIP", () => {
  it("uses the ZIP's fee rather than the flat settings figure", () => {
    const totals = computeOrderTotal(cart({}, "78015"), {
      ...settings,
      fees: { deliveryFee: 20 },
    });
    expect(totals.distanceSurcharge).toBe(75);
    expect(totals.deliveryFee).toBe(95);
  });

  it("falls back to the flat figure only when no zones are configured", () => {
    // The gate refuses an unserviced ZIP long before this, so the fallback is
    // reachable only for a settings document with no `deliveryZones` at all.
    // It must be the flat figure ALONE — adding a base term on top of it would
    // bill $40 for a trip nobody repriced.
    const totals = computeOrderTotal(cart({}, "78015"), {
      fees: { deliveryFee: 20 },
    });
    expect(totals.deliveryFee).toBe(20);
    expect(totals.deliveryBaseFee).toBe(20);
    expect(totals.distanceSurcharge).toBe(0);
  });

  it("charges the base fee for a ZIP priced at $0", () => {
    // The whole reason the base term exists. 25 of the seeded ZIPs carry no
    // surcharge; before it, each of them bought a truck, two people and a
    // round trip for nothing.
    const totals = computeOrderTotal(cart({}, "78205"), settings);
    expect(totals.distanceSurcharge).toBe(0);
    expect(totals.deliveryFee).toBe(20);
  });

  it("charges the surcharge alone when an admin sets the base fee to zero", () => {
    const totals = computeOrderTotal(cart({}, "78015"), {
      deliveryZones: { ...settings.deliveryZones, baseFee: 0 },
    });
    expect(totals.deliveryFee).toBe(75);
  });

  it("reads the current default when the document carries no base fee", () => {
    // A settings document written before the field existed must read the
    // current price, not free delivery.
    const { baseFee: _omitted, ...zonesWithoutBase } = settings.deliveryZones!;
    const totals = computeOrderTotal(cart({}, "78205"), {
      deliveryZones: zonesWithoutBase,
    });
    expect(totals.deliveryFee).toBe(DEFAULT_BASE_DELIVERY_FEE);
  });
});
