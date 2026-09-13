import {
  spanInDays,
  PHONE_PATTERN,
  ZIP_PATTERN,
  EMAIL_PATTERN,
} from "@/lib/dates";
import {
  getDeliveryFee,
  customFeeFor,
  fiveDigitZip,
  type DeliverySettings,
} from "@/lib/delivery/zones";
import { deliveryChargeFor } from "@/lib/delivery/deliveryCharge";
import { buildExtrasCatalog, MAX_EXTRA_QUANTITY } from "@/lib/extras-catalog";

/**
 * Re-exported so the many existing importers keep their path. The definition
 * lives in `@/lib/money` because `lib/delivery/deliveryCharge.ts` needs it and
 * cannot import this module without forming a cycle.
 */
import { roundCurrency } from "@/lib/money";

export { roundCurrency };

export const getNextDay = (dateStr: string): string => {
  // Append T00:00:00 so the date is parsed as local midnight, not UTC midnight
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Whole calendar days between two YYYY-MM-DD strings, minimum 1.
 *
 * Differencing local-midnight timestamps is wrong across a DST boundary: in
 * America/Chicago, 2025-11-02 → 2025-11-03 is 25 hours, which a ceil() of the
 * millisecond difference reports as 2 days — billing a one-night rental twice.
 * Comparing UTC-normalised calendar dates keeps every day exactly 24 hours.
 */
export const calculateRentalDays = (
  rentalDate: string,
  returnDate: string,
): number => {
  const diffDays = spanInDays(rentalDate, returnDate);
  return Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
};

/**
 * The wizard's field checks, sharing their patterns with the zod request
 * schemas so a value cannot pass all five steps and then be rejected at submit.
 *
 * The email pattern used to be `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` here and zod's
 * `.email()` on the server, so `a@b..c` cleared the form and 400'd at checkout.
 */
export const validateEmail = (email: string): boolean =>
  EMAIL_PATTERN.test(email.trim());

export const validatePhone = (phone: string): boolean =>
  PHONE_PATTERN.test(phone);

export const validateZipCode = (zipCode: string): boolean =>
  ZIP_PATTERN.test(zipCode);

/**
 * Is this ZIP in the service area?
 *
 * **Priced is serviced — that is the whole rule.** `customFees` is both the
 * price list and the definition of the area, so a ZIP with a fee is deliverable
 * and a ZIP without one is not. This replaced a hardcoded 120-entry array named
 * `isBexarCountyZipCode`, which meant the area could only change with a deploy
 * and which named a county we no longer claim in customer copy.
 *
 * Goes through `customFeeFor` rather than `customFees[zip]` so a server-side
 * caller holding a Mongoose `Map` is not silently told "not serviced".
 *
 * The five-digit strip is load-bearing: `ZIP_PATTERN` admits `\d{5}-\d{4}`, and
 * comparing the full nine digits turned away every valid ZIP+4 in the county.
 */
export const isServicedZipCode = (
  zipCode: string,
  settings?: DeliverySettings,
): boolean => {
  if (!zipCode) return false;
  return customFeeFor(settings, fiveDigitZip(zipCode)) !== null;
};

export const validateDeliveryTime = (
  time: string,
  startHour: number = 8,
  endHour: number = 18,
): boolean => {
  if (time === "ANY") return true;
  if (!time) return false;
  const [hours, minutes] = time.split(":").map(Number);
  const timeInMinutes = hours * 60 + minutes;
  const minTimeInMinutes = startHour * 60;
  const maxTimeInMinutes = endHour * 60;
  return timeInMinutes >= minTimeInMinutes && timeInMinutes <= maxTimeInMinutes;
};

// ---------------------------------------------------------------------------
// Centralised order-total calculation
// Used by PricingSummary, ReviewStep, and OrderForm to ensure a single source
// of truth for all pricing maths.
// ---------------------------------------------------------------------------

import { calculatePrice } from "@/lib/pricing";
import { OrderFormData, type ExtraItem } from "./types";

export interface SettingsOverrides {
  fees?: {
    salesTaxRate?: number;
    processingFeeRate?: number;
    serviceDiscountRate?: number;
    /**
     * The old flat fee. Still read, but only as the last fallback for an order
     * whose ZIP has no price of its own — which the service-area gate refuses
     * before it can reach pricing.
     */
    deliveryFee?: number;
    /** What a ZIP with no fee band falls back to. See `minimumForZip`. */
    minOrderAmount?: number;
  };
  /** Per-ZIP surcharges and the zone geography. The only price there is. */
  deliveryZones?: DeliverySettings;
  extras?: Record<string, { price: number }>;
  machines?: {
    single?: { basePrice: number };
    double?: { basePrice: number };
    triple?: { basePrice: number };
  };
  mixers?: Record<
    string,
    { label?: string; description?: string; price: number }
  >;
  operations?: {
    deliveryWindowStartHour?: number;
    deliveryWindowEndHour?: number;
  };
}

export interface OrderTotals {
  basePrice: number;
  mixerPrice: number;
  /** Base fee plus distance surcharge — what the order is actually billed. */
  deliveryFee: number;
  /** The flat portion of `deliveryFee`. See `@/lib/delivery/deliveryCharge`. */
  deliveryBaseFee: number;
  /** The ZIP's own portion of `deliveryFee`. Zero is a real answer. */
  distanceSurcharge: number;
  perDayRate: number;
  rentalDays: number;
  extrasTotal: number;
  /**
   * Machine rate x days, plus extras. **Excludes the distance surcharge.**
   *
   * This is what an order minimum is measured against. The surcharge is the
   * cost the minimum exists to cover, so it must not be what clears it — a $92
   * cart must not qualify for a $100 floor by being delivered somewhere
   * expensive.
   */
  rentalSubtotal: number;
  subtotal: number;
  serviceDiscountAmount: number;
  discountedSubtotal: number;
  salesTax: number;
  processingFee: number;
  /** Total without the 3% card-processing fee — sales tax applied to discounted subtotal only. Matches QuickBooks "Cash Price". */
  cashPrice: number;
  /** The true checkout total — matches QuickBooks "Online Price (with 3% card fee)". */
  finalTotal: number;
}

export function computeOrderTotal(
  formData: OrderFormData,
  settings?: SettingsOverrides,
): OrderTotals {
  // Delivery is two terms, summed in exactly one place (`deliveryChargeFor`):
  // the ZIP's own distance surcharge, and the flat base fee every order pays.
  //
  // The surcharge comes from the order's own ZIP, never from a settings
  // default and never from a request body. `getDeliveryFee` answers 0 for a
  // ZIP nobody priced; that is not the gate — `isServicedZipCode` in the
  // browser and `resolveDeliveryFee` on the server are — it is only what keeps
  // a NaN out of a total if the gate is ever bypassed.
  //
  // With no `deliveryZones` at all there is no ZIP table to read and no base
  // fee stored, so the legacy flat `fees.deliveryFee` answers alone. Adding a
  // base term on top of it there would bill $40 for a trip nobody repriced.
  const zipCode = formData.customer?.address?.zipCode ?? "";
  const deliveryCharge = settings?.deliveryZones
    ? deliveryChargeFor({
        distanceSurcharge: getDeliveryFee(zipCode, settings.deliveryZones),
        baseFee: settings.deliveryZones.baseFee,
      })
    : undefined;

  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers,
    {
      deliveryFee: deliveryCharge?.total ?? settings?.fees?.deliveryFee,
      salesTaxRate: settings?.fees?.salesTaxRate,
      processingFeeRate: settings?.fees?.processingFeeRate,
      machines: settings?.machines,
      mixers: settings?.mixers,
    },
  );

  const perDayRate = priceBreakdown.basePrice + priceBreakdown.mixerPrice;

  const rentalDays =
    formData.rentalDate && formData.returnDate
      ? calculateRentalDays(formData.rentalDate, formData.returnDate)
      : 1;

  // Prices and pricingType come from the catalog, never from the item objects
  // themselves — those may have arrived in a request body. An id that isn't in
  // the catalog contributes nothing; the API layer rejects such ids outright.
  const extrasCatalog = buildExtrasCatalog({
    extras: settings?.extras,
    mixers: settings?.mixers,
  });

  const extrasTotal = roundCurrency(
    formData.selectedExtras.reduce((sum, item) => {
      const catalogItem = extrasCatalog.get(item.id);
      if (!catalogItem) return sum;

      // Clamped to the same ceiling `resolveSelectedExtras` applies server
      // side. Without it a restored draft carrying `quantity: 50` rendered a
      // sidebar and review total the server would never charge.
      const quantity = catalogItem.allowQuantity
        ? Math.min(
            MAX_EXTRA_QUANTITY,
            Math.max(1, Math.floor(Number(item.quantity) || 1)),
          )
        : 1;
      const multiplier = catalogItem.pricingType === "flat" ? 1 : rentalDays;
      return sum + catalogItem.price * quantity * multiplier;
    }, 0),
  );

  // What the order minimum is measured against: rentals only, no surcharge.
  const rentalSubtotal = roundCurrency(perDayRate * rentalDays + extrasTotal);

  // Subtotal = machine rate × days + delivery + extras
  const subtotal = roundCurrency(
    perDayRate * rentalDays + priceBreakdown.deliveryFee + extrasTotal,
  );

  const discountRate = settings?.fees?.serviceDiscountRate ?? 0.1;
  const serviceDiscountAmount = roundCurrency(
    formData.isServiceDiscount ? subtotal * discountRate : 0,
  );

  const discountedSubtotal = roundCurrency(subtotal - serviceDiscountAmount);

  // Matches the QuickBooks invoice: processing fee is a taxable line item, so
  // sales tax is applied to (discountedSubtotal + processingFee).
  const taxRate = settings?.fees?.salesTaxRate ?? 0.0825;
  const processingRate = settings?.fees?.processingFeeRate ?? 0.03;
  const processingFee = roundCurrency(discountedSubtotal * processingRate);
  const salesTax = roundCurrency(
    (discountedSubtotal + processingFee) * taxRate,
  );

  // Cash Price = what a customer pays when settling in cash on delivery (no
  // card-processing fee, tax on subtotal only). Mirrors QB's "Cash Price" line.
  const cashPrice = roundCurrency(
    discountedSubtotal + discountedSubtotal * taxRate,
  );

  const finalTotal = roundCurrency(
    discountedSubtotal + processingFee + salesTax,
  );

  return {
    basePrice: priceBreakdown.basePrice,
    mixerPrice: priceBreakdown.mixerPrice,
    deliveryFee: priceBreakdown.deliveryFee,
    // Reported from the resolved charge, not re-derived: with no
    // `deliveryZones` configured the legacy flat fee is the whole of it and
    // none of it is a distance surcharge.
    deliveryBaseFee: deliveryCharge?.baseFee ?? priceBreakdown.deliveryFee,
    distanceSurcharge: deliveryCharge?.distanceSurcharge ?? 0,
    perDayRate,
    rentalDays,
    extrasTotal,
    rentalSubtotal,
    subtotal,
    serviceDiscountAmount,
    discountedSubtotal,
    salesTax,
    processingFee,
    cashPrice,
    finalTotal,
  };
}

/**
 * The post-checkout redirect target.
 *
 * Deliberately narrow: `/success` reads only these three params, and GA4
 * records the whole query string as `page_location`. Adding a customer's name,
 * email or the order total here ships PII to Google (a ToS violation they can
 * purge data over) and makes every booking its own unique page path, which
 * destroys `/success` as a conversion page. Keep this list in sync with what
 * `src/app/success/page.tsx` actually reads — nothing more.
 */
/** One entry in a GA4 ecommerce `items` array. */
export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  item_category: "machine" | "extra";
  price: number;
  quantity: number;
}

/**
 * The GA4 `items` array for an order, priced from the extras catalog.
 *
 * `purchase` and `begin_checkout` both send this, and they used to build it
 * separately — which is how the two came to disagree about what was in the
 * cart. Prices come from `buildExtrasCatalog()` and never from the item on
 * `formData`, for the same reason `computeOrderTotal` ignores them: an extra
 * carries whatever price the client last saw, which is not authoritative.
 *
 * The machine is modelled as one item priced per day with `quantity` set to
 * the number of rental days, so `Σ(price × quantity)` reconciles against
 * `subtotal` minus delivery.
 */
export function buildAnalyticsItems(
  formData: OrderFormData,
  totals: Pick<OrderTotals, "perDayRate" | "rentalDays">,
  extrasCatalog: Map<string, ExtraItem>,
): AnalyticsItem[] {
  return [
    {
      item_id: `machine-${formData.machineType}`,
      item_name: `${formData.machineType} margarita machine`,
      item_category: "machine",
      price: totals.perDayRate,
      quantity: totals.rentalDays,
    },
    ...formData.selectedExtras.map((extra): AnalyticsItem => {
      const item = extrasCatalog.get(extra.id);
      return {
        item_id: extra.id,
        item_name: item?.name ?? extra.id,
        item_category: "extra",
        price: item?.price ?? 0,
        quantity: extra.quantity ?? 1,
      };
    }),
  ];
}

export function buildSuccessUrl(
  bookingId: string,
  machineType: string,
  selectedMixers: string[] = [],
  options: { paid?: boolean } = {},
): string {
  const params = new URLSearchParams();
  params.append("bookingId", bookingId);
  params.append("machineType", machineType);

  if (selectedMixers.length > 0) {
    params.append("mixers", selectedMixers.join(","));
  }

  // A flag, not an amount. `/success` has to know whether to promise an
  // invoice, and telling a customer who has just paid that one is coming is
  // the one thing that page must not do. It carries no money and no PII, so
  // the rule above still holds.
  if (options.paid) {
    params.append("paid", "1");
  }

  return `/success?${params.toString()}`;
}
