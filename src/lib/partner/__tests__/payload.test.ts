import {
  buildOrderPayload,
  buildStatusPayload,
  buildLineItems,
  PARTNER_SYSTEM,
} from "@/lib/partner/payload";
import { computeOrderTotal } from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";

/**
 * The payload is the one place the two apps' arithmetic has to meet, and they
 * define `subtotal` differently: bounce-v3 counts the delivery fee and the
 * processing fee inside it, we count neither. Everything else lines up, because
 * bounce taxes the processing fee the same way we do.
 *
 * So these tests assert bounce-v3's OWN identities against totals produced by
 * the real `computeOrderTotal`. A helper that re-derived the expectation the
 * way the builder does would agree with whatever either of them did.
 */

const CENT = 0.01;

function form(overrides: Partial<OrderFormData> = {}): OrderFormData {
  return {
    machineType: "triple",
    capacity: 45,
    selectedMixers: ["margarita", "pina-colada", "strawberry-daiquiri"],
    selectedExtras: [],
    price: 0,
    rentalDate: "2026-10-04",
    rentalTime: "11:00",
    returnDate: "2026-10-06",
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
    notes: "Gate code 1234",
    isServiceDiscount: false,
    ...overrides,
  } as OrderFormData;
}

function payloadFor(data: OrderFormData, capturedAmount = 0) {
  const totals = computeOrderTotal(data);
  return {
    totals,
    payload: buildOrderPayload({
      event: "order.created",
      eventId: "evt_test",
      sequence: 1,
      partnerOrderId: "rental-1",
      bookingId: "AB3XY9",
      rental: data,
      totals,
      resolvedMixers: data.selectedMixers,
      mixerLabel: (id) => `Mix: ${id}`,
      status: "pending_payment",
      paymentStatus: "pending",
      paymentMethod: "invoice",
      capturedAmount,
    }),
  };
}

describe("the money envelope bounce-v3 will store", () => {
  it("satisfies bounce's subtotal identity", () => {
    const { payload } = payloadFor(form());
    const t = payload.data.order.totals!;

    expect(
      Math.abs(
        t.itemsTotal +
          t.deliveryFee +
          t.specificTimeCharge +
          t.processingFee -
          t.subtotal,
      ),
    ).toBeLessThanOrEqual(CENT);
  });

  it("satisfies bounce's total identity", () => {
    const { payload } = payloadFor(form());
    const t = payload.data.order.totals!;

    expect(
      Math.abs(t.subtotal - t.discountAmount + t.taxAmount - t.totalAmount),
    ).toBeLessThanOrEqual(CENT);
  });

  it("carries the specific-time charge inside bounce's subtotal", () => {
    // Both legs pinned: $25 each. bounce-v3's receiver refuses a payload whose
    // subtotal is not items + delivery + specific-time + processing.
    const { totals, payload } = payloadFor(form());
    const t = payload.data.order.totals!;

    expect(totals.specificTimeCharge).toBe(50);
    expect(t.specificTimeCharge).toBe(50);
    expect(
      Math.abs(
        t.itemsTotal +
          t.deliveryFee +
          t.specificTimeCharge +
          t.processingFee -
          t.subtotal,
      ),
    ).toBeLessThanOrEqual(CENT);
  });

  it("sends a zero specific-time charge for a flexible booking", () => {
    const { payload } = payloadFor(
      form({ rentalTime: "ANY", returnTime: "ANY" }),
    );
    expect(payload.data.order.totals!.specificTimeCharge).toBe(0);
  });

  it("preserves our finalTotal exactly", () => {
    // The whole point of the mirror: bounce-v3 re-prices nothing, so the
    // number it stores must be the number the customer was quoted.
    const { totals, payload } = payloadFor(form());

    expect(payload.data.order.totals!.totalAmount).toBe(totals.finalTotal);
  });

  it("makes the line totals sum to itemsTotal", () => {
    const { payload } = payloadFor(
      form({
        selectedExtras: [
          {
            id: "table-chairs",
            name: "Table & Chairs Set",
            description: "",
            price: 19.95,
            quantity: 2,
            allowQuantity: true,
          },
        ],
      }),
    );
    const order = payload.data.order;
    const summed = order.items!.reduce((n, i) => n + i.totalPrice, 0);

    expect(Math.abs(summed - order.totals!.itemsTotal)).toBeLessThanOrEqual(
      CENT,
    );
  });

  it("balances the deposit against the total when paid", () => {
    const { totals, payload } = payloadFor(form(), 500);
    const t = payload.data.order.totals!;

    expect(t.depositAmount).toBe(Math.min(500, totals.finalTotal));
    expect(
      Math.abs(t.totalAmount - t.depositAmount - t.balanceDue),
    ).toBeLessThanOrEqual(CENT);
  });
});

describe("line items", () => {
  it("prices a multi-day machine per day, never as one multiplied line", () => {
    // bounce-v3's item hook silently rewrites totalPrice to quantity x
    // unitPrice, and its receiver refuses a payload where the two disagree. A
    // three-day rental sent as quantity 1 is the shape that breaks both.
    const { totals, payload } = payloadFor(form());
    const machine = payload.data.order.items!.find(
      (i) => i.kind === "machine",
    )!;

    expect(machine.quantity).toBe(totals.rentalDays);
    expect(machine.unitPrice).toBe(totals.perDayRate);
    expect(machine.quantity * machine.unitPrice).toBeCloseTo(
      machine.totalPrice,
      2,
    );
  });

  it("keeps every line's quantity x unitPrice equal to its total", () => {
    const { payload } = payloadFor(
      form({
        selectedExtras: [
          {
            id: "table-chairs",
            name: "Table & Chairs Set",
            description: "",
            price: 19.95,
            quantity: 3,
            allowQuantity: true,
          },
          {
            id: "cotton-candy",
            name: "Cotton Candy Machine",
            description: "",
            price: 49.95,
          },
        ],
      }),
    );

    for (const item of payload.data.order.items!) {
      expect(item.quantity * item.unitPrice).toBeCloseTo(item.totalPrice, 2);
      expect(Number.isInteger(item.quantity)).toBe(true);
      expect(item.quantity).toBeGreaterThanOrEqual(1);
    }
  });

  it("prices each add-on on its own line", () => {
    // What a native bounce order looks like, and what the crew needs: a table
    // is distinguishable from a popcorn machine on the packing list.
    const data = form({
      selectedExtras: [
        {
          id: "table-chairs",
          name: "Table & Chairs Set",
          description: "",
          price: 19.95,
          quantity: 2,
          allowQuantity: true,
        },
      ],
    });
    const { totals, payload } = payloadFor(data);
    const items = payload.data.order.items!;

    expect(totals.extrasTotal).toBeGreaterThan(0);
    expect(items.some((i) => i.sku === "add-ons")).toBe(false);

    const line = items.find((i) => i.sku === "table-chairs")!;
    expect(line.name).toBe("Table & Chairs Set");
    expect(line.unitPrice).toBe(19.95);
    expect(line.totalPrice).toBeCloseTo(totals.extrasTotal, 2);
  });

  it("collapses to an aggregate line when the catalog has moved on", () => {
    // The guard those per-line prices need. `computeOrderTotal` prices an extra
    // by looking its **id** up in the catalog and drops one the catalog no
    // longer knows, so a line built from the stored price disagrees with the
    // authoritative total the moment an admin retires an add-on. The receiver
    // refuses the whole event over that difference, which loses the order from
    // the shared calendar with nothing saying why.
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const data = form({
      selectedExtras: [
        {
          id: "table-chairs",
          name: "Table & Chairs Set",
          description: "",
          price: 19.95,
          quantity: 1,
        },
        {
          id: "an-extra-nobody-sells-any-more",
          name: "Retired Add-on",
          description: "",
          price: 250,
          quantity: 1,
        },
      ],
    });
    const { totals, payload } = payloadFor(data);
    const items = payload.data.order.items!;

    const aggregate = items.find((i) => i.sku === "add-ons")!;
    expect(aggregate).toBeDefined();
    expect(aggregate.totalPrice).toBe(totals.extrasTotal);

    // Both add-ons still appear by name, at zero, so the packing list survives.
    expect(items.find((i) => i.sku === "table-chairs")!.totalPrice).toBe(0);
    expect(
      items.find((i) => i.sku === "an-extra-nobody-sells-any-more")!.totalPrice,
    ).toBe(0);
  });

  it("emits no add-ons line when there are none", () => {
    const { payload } = payloadFor(form());

    expect(payload.data.order.items!.some((i) => i.sku === "add-ons")).toBe(
      false,
    );
  });

  it("still balances when the catalog no longer knows an extra", () => {
    // The regression this shape exists for. A stored extra whose id has since
    // been deleted from Settings contributes nothing to `extrasTotal`, and the
    // lines must follow it rather than the stale stored price.
    const data = form({
      selectedExtras: [
        {
          id: "an-extra-nobody-sells-any-more",
          name: "Retired Add-on",
          description: "",
          price: 250,
          quantity: 1,
        },
      ],
    });
    const { payload } = payloadFor(data);
    const order = payload.data.order;
    const summed = order.items!.reduce((n, i) => n + i.totalPrice, 0);

    expect(Math.abs(summed - order.totals!.itemsTotal)).toBeLessThanOrEqual(
      CENT,
    );
    expect(
      Math.abs(
        order.totals!.subtotal -
          order.totals!.discountAmount +
          order.totals!.taxAmount -
          order.totals!.totalAmount,
      ),
    ).toBeLessThanOrEqual(CENT);
  });

  it("carries mixers at zero so the crew knows what to load", () => {
    // They are already inside perDayRate; pricing them again would double
    // charge, and omitting them loses the flavours entirely.
    const totals = computeOrderTotal(form());
    const items = buildLineItems(
      form(),
      totals,
      ["margarita", "pina-colada"],
      (id) => `Mix: ${id}`,
    );
    const mixers = items.filter((i) => i.kind === "mixer");

    expect(mixers).toHaveLength(2);
    expect(mixers.every((m) => m.totalPrice === 0)).toBe(true);
    expect(mixers.map((m) => m.name)).toEqual([
      "Mix: margarita",
      "Mix: pina-colada",
    ]);
  });
});

describe("the envelope", () => {
  it("names this system so the receiver can refuse anything else", () => {
    const { payload } = payloadFor(form());

    expect(payload.source).toBe(PARTNER_SYSTEM);
    expect(PARTNER_SYSTEM).toBe("satx-ritas");
  });

  it("carries the rental window and the customer", () => {
    const { payload } = payloadFor(form());
    const order = payload.data.order;

    expect(order.rental).toEqual({
      startDate: "2026-10-04",
      startTime: "11:00",
      endDate: "2026-10-06",
      endTime: "11:00",
    });
    expect(order.customer.email).toBe("jane@example.com");
    expect(order.customer.address.zipCode).toBe("78209");
    expect(order.partnerBookingId).toBe("AB3XY9");
  });
});

describe("a status-only event", () => {
  it("carries no money at all", () => {
    // Rebuilding totals for a months-old booking would price it at today's
    // settings. The receiver leaves the stored envelope alone when both are
    // absent, which is the only safe thing to send here.
    const payload = buildStatusPayload({
      event: "order.cancelled",
      eventId: "evt_cancel",
      sequence: 2,
      partnerOrderId: "rental-1",
      bookingId: "AB3XY9",
      rental: form(),
      status: "cancelled",
      paymentStatus: "failed",
      paymentMethod: "paypal",
    });

    expect(payload.data.order.items).toBeUndefined();
    expect(payload.data.order.totals).toBeUndefined();
    expect(payload.data.order.status).toBe("cancelled");
    expect(payload.data.order.paymentStatus).toBe("failed");
  });
});
