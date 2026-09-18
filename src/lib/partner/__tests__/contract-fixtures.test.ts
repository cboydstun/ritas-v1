/**
 * @jest-environment node
 */
/**
 * The payloads bounce-v3's contract test runs against.
 *
 * Each side's own tests can only check its own arithmetic, and the two apps
 * disagree about what a "subtotal" is — ours excludes the delivery and
 * processing fees, theirs includes both. The seam between them is only tested
 * in one place: `partnerOrderContract.test.ts` over there, against fixtures
 * generated here.
 *
 * Every run asserts the cases are well formed. Set `XCHECK_OUT` to also write
 * them out, then copy the file over
 * `bounce-v3/src/services/__tests__/fixtures/satx-ritas-payloads.json`:
 *
 *   XCHECK_OUT=/tmp/satx-ritas-payloads.json \
 *     npx jest src/lib/partner/__tests__/contract-fixtures.test.ts
 *
 * Add a case here whenever a cart shape starts being priced differently. The
 * add-on cases are the ones that matter: the first version of this fixture set
 * used ids the catalog did not know, so every `extrasTotal` was zero and the
 * whole suite passed while exercising nothing.
 */
import fs from "fs";
import { buildOrderPayload } from "@/lib/partner/payload";
import { computeOrderTotal } from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";

const OUT = process.env.XCHECK_OUT;

function form(o: Partial<OrderFormData> = {}): OrderFormData {
  return {
    machineType: "triple",
    capacity: 45,
    selectedMixers: ["margarita", "pina-colada"],
    selectedExtras: [],
    price: 0,
    rentalDate: "2026-10-04",
    rentalTime: "11:00",
    returnDate: "2026-10-05",
    returnTime: "11:00",
    customer: {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "2105551234",
      address: {
        street: "123 Alamo St",
        city: "San Antonio",
        state: "TX",
        zipCode: "78209",
      },
    },
    notes: "",
    isServiceDiscount: false,
    ...o,
  } as OrderFormData;
}

const CASES: Array<[string, OrderFormData, number]> = [
  ["single day, no extras", form({ returnDate: "2026-10-04" }), 0],
  // Every other case pins both legs, so each carries the $50 specific-time
  // charge. This one proves the flexible shape crosses the seam too.
  [
    "flexible times, no specific-time charge",
    form({ rentalTime: "ANY", returnTime: "ANY" }),
    0,
  ],
  ["three days", form({ returnDate: "2026-10-07" }), 0],
  [
    "per-day extra qty 3 over 3 days",
    form({
      returnDate: "2026-10-07",
      selectedExtras: [
        {
          id: "table-chairs",
          name: "Table & Chairs Set",
          description: "",
          price: 19.95,
          quantity: 3,
          allowQuantity: true,
        },
      ],
    }),
    0,
  ],
  [
    "flat extra plus paid in full",
    form({
      selectedExtras: [
        {
          id: "cotton-candy",
          name: "Cotton Candy Machine",
          description: "",
          price: 49.95,
        },
      ],
    }),
    9999,
  ],
  [
    "single machine, unpriced zip",
    form({
      machineType: "single",
      capacity: 15,
      selectedMixers: ["margarita"],
    }),
    0,
  ],
  [
    "retired extra the catalog no longer knows",
    form({
      selectedExtras: [
        {
          id: "gone-from-settings",
          name: "Retired",
          description: "",
          price: 250,
          quantity: 1,
        },
        {
          id: "popcorn-machine",
          name: "Popcorn Machine",
          description: "",
          price: 49.95,
        },
      ],
    }),
    0,
  ],
];

function build() {
  return CASES.map(([label, data, captured], i) => {
    const totals = computeOrderTotal(data);
    return {
      label,
      ritasFinalTotal: totals.finalTotal,
      payload: buildOrderPayload({
        event: "order.created",
        eventId: `evt_contract_${i}`,
        sequence: 1,
        partnerOrderId: `rental-${i}`,
        bookingId: `BOOK${i}`,
        rental: data,
        totals,
        resolvedMixers: data.selectedMixers,
        mixerLabel: (id) => `Mix ${id}`,
        status: captured > 0 ? "confirmed" : "pending_payment",
        paymentStatus: captured > 0 ? "completed" : "pending",
        paymentMethod: captured > 0 ? "paypal" : "invoice",
        capturedAmount: captured,
      }),
    };
  });
}

describe("the contract fixtures", () => {
  it("covers at least one cart with a priced add-on", () => {
    // The guard against the mistake that made the first version of this
    // vacuous: fabricated extra ids price at zero, so the add-ons line never
    // appears and the arithmetic it exists to test is never exercised.
    const priced = build().filter((c) =>
      c.payload.data.order.items!.some(
        (i) => i.sku === "add-ons" && i.totalPrice > 0,
      ),
    );

    expect(priced.length).toBeGreaterThan(0);
  });

  it("covers both a pinned and a flexible booking", () => {
    // Same guard, for the specific-time charge: a fixture set where every
    // case carried zero would pass bounce's subtotal check without testing
    // that it counts the charge.
    const charges = build().map(
      (c) => c.payload.data.order.totals!.specificTimeCharge,
    );

    expect(charges.some((c) => c > 0)).toBe(true);
    expect(charges).toContain(0);
  });

  it("emits self-consistent money for every case", () => {
    for (const { payload, ritasFinalTotal } of build()) {
      const order = payload.data.order;
      const t = order.totals!;
      const summed = order.items!.reduce((n, i) => n + i.totalPrice, 0);

      expect(Math.abs(summed - t.itemsTotal)).toBeLessThanOrEqual(0.01);
      expect(
        Math.abs(
          t.itemsTotal +
            t.deliveryFee +
            t.specificTimeCharge +
            t.processingFee -
            t.subtotal,
        ),
      ).toBeLessThanOrEqual(0.01);
      expect(
        Math.abs(t.subtotal - t.discountAmount + t.taxAmount - t.totalAmount),
      ).toBeLessThanOrEqual(0.01);
      expect(t.totalAmount).toBe(ritasFinalTotal);
    }
  });

  it("writes the fixture file when asked", () => {
    const cases = build();
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(cases, null, 2));

    expect(cases.length).toBeGreaterThanOrEqual(5);
  });
});
