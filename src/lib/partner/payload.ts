import { roundCurrency } from "@/lib/money";
import { MAX_EXTRA_QUANTITY } from "@/lib/extras-catalog";
import type { OrderTotals } from "@/components/order/utils";
import type { ExtraItem } from "@/components/order/types";

/**
 * The wire contract for an order pushed to bounce-v3.
 *
 * **Zod-free and mongoose-free on purpose**, the same discipline `lib/dates.ts`,
 * `lib/blog.ts` and `lib/landing.ts` keep. It is imported by the send path, by
 * the offline tests, and it is the one description of a shape the other repo
 * parses — so it must not drag a request schema or a model into whatever
 * imports it.
 *
 * Both businesses run out of one depot, with one truck and one crew, so a
 * margarita booking is a real claim on the same day's capacity. bounce-v3
 * mirrors it into its own orders collection to put it on the admin list, the
 * calendar and the revenue rollup.
 */

export const PARTNER_SYSTEM = "satx-ritas";

export const PARTNER_EVENTS = [
  "order.created",
  "order.updated",
  "order.cancelled",
] as const;

export type PartnerEvent = (typeof PARTNER_EVENTS)[number];

export interface PartnerLineItem {
  kind: "machine" | "mixer" | "extra";
  sku?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PartnerTotals {
  currency: "USD";
  itemsTotal: number;
  deliveryFee: number;
  deliveryBaseFee: number;
  specificTimeCharge: number;
  discountAmount: number;
  processingFee: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  balanceDue: number;
}

export interface PartnerOrderPayload {
  id: string;
  type: PartnerEvent;
  timestamp: string;
  source: typeof PARTNER_SYSTEM;
  sequence: number;
  data: {
    order: {
      partnerOrderId: string;
      partnerBookingId?: string;
      status: string;
      paymentStatus: string;
      paymentMethod: "paypal" | "invoice" | "cash";
      notes?: string;
      rental: {
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
      };
      customer: {
        name: string;
        email: string;
        phone?: string;
        address: {
          street?: string;
          city?: string;
          state?: string;
          zipCode?: string;
        };
      };
      /**
       * Present on `order.created` only.
       *
       * A status change deliberately carries neither, and bounce-v3 re-prices
       * nothing when they are absent. Rebuilding them for a months-old booking
       * would price it at today's `Settings` — the exact bug the admin PUT
       * route was fixed for.
       */
      items?: PartnerLineItem[];
      totals?: PartnerTotals;
    };
  };
}

/** The structural slice of a Rental this module reads. */
export interface PartnerRentalLike {
  machineType: string;
  rentalDate: string;
  rentalTime: string;
  returnDate: string;
  returnTime: string;
  notes?: string;
  selectedExtras?: ExtraItem[];
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  };
}

const MACHINE_LABELS: Record<string, string> = {
  single: "Single Tank Frozen Drink Machine",
  double: "Double Tank Frozen Drink Machine",
  triple: "Triple Tank Frozen Drink Machine",
};

/**
 * Line items, in the shape bounce-v3 will accept.
 *
 * Two rules drive the shape, and both were learned the hard way.
 *
 * **Every line's `quantity * unitPrice` must equal its `totalPrice`.**
 * bounce-v3's `OrderItemSchema` has a pre-validate hook that silently rewrites
 * `totalPrice` to that product whenever the two disagree, and its receiver
 * refuses a payload where they do. So a multi-day rental goes as
 * `quantity: days, unitPrice: per-day rate`, never one line at a multiplied
 * price.
 *
 * **Add-ons are priced individually, with a guard.** That is the shape a
 * native bounce order has, and the crew needs to see a table apart from a
 * popcorn machine. But `computeOrderTotal` prices an extra by looking its
 * **id** up in the catalog and drops an id the catalog no longer knows, so
 * per-line prices can disagree with the authoritative total the moment an
 * admin retires an add-on. When they do, the lines collapse to one aggregate
 * line rather than ship a payload the receiver will refuse outright.
 *
 * Mixers ride at zero for the same reason in reverse: they are already inside
 * `perDayRate`, so pricing them again would double-charge. Both they and the
 * extras still appear by name, because the crew loading the truck needs to
 * know what the booking bought, and that is not recoverable from a total.
 */
export function buildLineItems(
  rental: PartnerRentalLike,
  totals: OrderTotals,
  resolvedMixers: string[],
  mixerLabel: (id: string) => string,
): PartnerLineItem[] {
  const days = totals.rentalDays;

  const items: PartnerLineItem[] = [
    {
      kind: "machine",
      sku: rental.machineType,
      name: MACHINE_LABELS[rental.machineType] ?? "Frozen Drink Machine",
      description:
        days === 1 ? "1 day rental" : `${days} day rental, per-day rate`,
      quantity: days,
      unitPrice: totals.perDayRate,
      totalPrice: roundCurrency(totals.perDayRate * days),
    },
  ];

  for (const id of resolvedMixers) {
    items.push({
      kind: "mixer",
      sku: id,
      name: mixerLabel(id),
      description: "Included in the machine rate",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    });
  }

  // Add-ons, one line each, priced the way `computeOrderTotal` prices them:
  // per-day unless the catalog entry says flat, and clamped to the same
  // ceiling. Named and priced individually because the crew loading the truck
  // needs to see a table apart from a popcorn machine, and because that is the
  // shape a native bounce order has.
  const extraLines: PartnerLineItem[] = (rental.selectedExtras ?? []).map(
    (extra) => {
      const perDay = extra.pricingType !== "flat";
      const quantity = Math.min(
        MAX_EXTRA_QUANTITY,
        Math.max(1, Math.floor(Number(extra.quantity) || 1)),
      );
      const units = perDay ? quantity * days : quantity;

      return {
        kind: "extra" as const,
        sku: extra.id,
        name: extra.name,
        description:
          perDay && days > 1 ? `${quantity} x ${days} days` : undefined,
        quantity: units,
        unitPrice: extra.price,
        totalPrice: roundCurrency(extra.price * units),
      };
    },
  );

  // The guard those individual prices need.
  //
  // `computeOrderTotal` prices an extra by looking its **id** up in the
  // catalog, ignoring the `price` on the stored item, and drops an id the
  // catalog no longer knows. So the moment an admin retires an add-on between
  // a booking being taken and its payment captured, these lines and the
  // authoritative total disagree — and the receiver refuses the whole event
  // over the difference, which loses the order from the shared calendar with
  // nothing anywhere saying why.
  //
  // When they disagree, fall back to one aggregate line carrying the
  // authoritative figure. The add-ons still appear by name at zero, so the
  // crew keeps the packing list; only the per-line prices are given up.
  const extrasLineTotal = roundCurrency(
    extraLines.reduce((sum, line) => sum + line.totalPrice, 0),
  );

  if (Math.abs(extrasLineTotal - totals.extrasTotal) <= 0.01) {
    items.push(...extraLines);
    return items;
  }

  console.warn("PARTNER_EXTRAS_PRICE_MISMATCH", {
    lines: extrasLineTotal,
    authoritative: totals.extrasTotal,
  });

  for (const line of extraLines) {
    items.push({ ...line, quantity: 1, unitPrice: 0, totalPrice: 0 });
  }

  if (totals.extrasTotal > 0) {
    items.push({
      kind: "extra",
      sku: "add-ons",
      name: "Add-ons",
      description: "Total for the add-on lines above",
      quantity: 1,
      unitPrice: totals.extrasTotal,
      totalPrice: totals.extrasTotal,
    });
  }

  return items;
}

/**
 * Map ritas totals onto bounce-v3's money envelope.
 *
 * The one thing to get right: **bounce's `subtotal` is not ours**. Its
 * `computeOrderTotals` defines subtotal as items + delivery + specific-time
 * charge + processing fee, where ours excludes the processing fee. Everything
 * else lines up exactly, because bounce taxes the processing fee too.
 *
 * `itemsTotal` is the sum of the lines actually emitted rather than
 * `rentalSubtotal`, so the receiver's line-sum check is exact instead of within
 * a rounding cent of it. `totalAmount` stays the authoritative `finalTotal` —
 * bounce re-prices nothing, and supplying every field is what keeps its
 * money-envelope hook out of its own branch.
 */
export function buildTotals(
  items: PartnerLineItem[],
  totals: OrderTotals,
  capturedAmount: number,
): PartnerTotals {
  const itemsTotal = roundCurrency(
    items.reduce((sum, item) => sum + item.totalPrice, 0),
  );
  const subtotal = roundCurrency(
    itemsTotal + totals.deliveryFee + totals.processingFee,
  );
  const totalAmount = totals.finalTotal;
  const depositAmount = roundCurrency(Math.min(capturedAmount, totalAmount));

  return {
    currency: "USD",
    itemsTotal,
    deliveryFee: totals.deliveryFee,
    deliveryBaseFee: totals.deliveryBaseFee,
    // We have no such line. Sent explicitly rather than omitted: a field the
    // receiver finds unset is one its money hook would fill for itself.
    specificTimeCharge: 0,
    // The service discount is retired; it survives only on legacy bookings.
    discountAmount: totals.serviceDiscountAmount,
    processingFee: totals.processingFee,
    subtotal,
    taxAmount: totals.salesTax,
    totalAmount,
    depositAmount,
    balanceDue: roundCurrency(totalAmount - depositAmount),
  };
}

export interface BuildPayloadInput {
  event: PartnerEvent;
  eventId: string;
  sequence: number;
  partnerOrderId: string;
  bookingId?: string;
  rental: PartnerRentalLike;
  totals: OrderTotals;
  resolvedMixers: string[];
  mixerLabel: (id: string) => string;
  status: string;
  paymentStatus: string;
  paymentMethod: "paypal" | "invoice" | "cash";
  /** What has actually been collected. Zero on the invoice path. */
  capturedAmount?: number;
}

interface BaseInput {
  event: PartnerEvent;
  eventId: string;
  sequence: number;
  partnerOrderId: string;
  bookingId?: string;
  rental: PartnerRentalLike;
  status: string;
  paymentStatus: string;
  paymentMethod: "paypal" | "invoice" | "cash";
}

function envelope(input: BaseInput): PartnerOrderPayload {
  return {
    id: input.eventId,
    type: input.event,
    timestamp: new Date().toISOString(),
    source: PARTNER_SYSTEM,
    sequence: input.sequence,
    data: {
      order: {
        partnerOrderId: input.partnerOrderId,
        partnerBookingId: input.bookingId,
        status: input.status,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod,
        notes: input.rental.notes,
        rental: {
          startDate: input.rental.rentalDate,
          startTime: input.rental.rentalTime,
          endDate: input.rental.returnDate,
          endTime: input.rental.returnTime,
        },
        customer: {
          name: input.rental.customer.name,
          email: input.rental.customer.email,
          phone: input.rental.customer.phone,
          address: {
            street: input.rental.customer.address?.street,
            city: input.rental.customer.address?.city,
            state: input.rental.customer.address?.state,
            zipCode: input.rental.customer.address?.zipCode,
          },
        },
      },
    },
  };
}

/**
 * The full payload for a booking bounce-v3 has not seen before.
 *
 * Requires the totals the order was actually priced with, which is why every
 * caller of this sits beside the write that produced them rather than reading
 * the stored document back.
 */
export function buildOrderPayload(
  input: BuildPayloadInput,
): PartnerOrderPayload {
  const items = buildLineItems(
    input.rental,
    input.totals,
    input.resolvedMixers,
    input.mixerLabel,
  );

  const payload = envelope(input);
  payload.data.order.items = items;
  payload.data.order.totals = buildTotals(
    items,
    input.totals,
    input.capturedAmount ?? 0,
  );

  return payload;
}

/**
 * A status or payment change on a booking bounce-v3 already holds.
 *
 * Carries no money at all. The receiver leaves the stored envelope alone when
 * items and totals are absent, so a cancellation cannot quietly re-price a
 * historical order — and this path has no honest totals to send anyway, only a
 * document and today's settings.
 */
export function buildStatusPayload(input: BaseInput): PartnerOrderPayload {
  return envelope(input);
}
