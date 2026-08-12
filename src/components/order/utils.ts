import {
  spanInDays,
  PHONE_PATTERN,
  ZIP_PATTERN,
  EMAIL_PATTERN,
} from "@/lib/dates";
import { buildExtrasCatalog, MAX_EXTRA_QUANTITY } from "@/lib/extras-catalog";

/**
 * Round a currency amount to cents, decimal half-up.
 *
 * `Number(x.toFixed(2))` rounds the *binary* double, so a value that is an
 * exact half-cent in decimal can round down: 489.50 * 0.03 is 14.685 in
 * decimal but 14.684999999999999 as a double, and toFixed(2) yields 14.68
 * rather than 14.69. That underbilled the processing fee by a cent and
 * cascaded into salesTax and finalTotal, leaving the stored price, the
 * confirmation email and the QuickBooks invoice (which rounds decimal
 * half-up) disagreeing. Adding one ULP before scaling restores half-up.
 */
export const roundCurrency = (amount: number): number =>
  Math.round(Number((amount * 100).toPrecision(12))) / 100;

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

export const isBexarCountyZipCode = (zipCode: string): boolean => {
  // Strip non-digits (the dash in a ZIP+4) and keep only the 5-digit prefix.
  // `ZIP_PATTERN` admits `\d{5}-\d{4}`, so stripping alone left a 9-digit
  // string that never matched an entry below: every valid ZIP+4 in Bexar
  // County was turned away as "outside our service area".
  const cleanZip = zipCode.replace(/\D/g, "").slice(0, 5);

  // Main San Antonio/Bexar County ZIP codes
  const bexarZips = [
    // Main San Antonio ZIP ranges (78201-78299). The generator used to start
    // at i=0 for 99 entries, which produced 78200-78298: it turned away the
    // real ZIP 78299 and accepted the unassigned 78200.
    ...Array.from(
      { length: 99 },
      (_, i) => `782${String(i + 1).padStart(2, "0")}`,
    ),

    // Additional Bexar County ZIPs
    "78002",
    "78006",
    "78009",
    "78015",
    "78023",
    "78039",
    "78052",
    "78054",
    "78056",
    "78069",
    "78073",
    "78101",
    "78108",
    "78109",
    "78112",
    "78124",
    "78148",
    "78150",
    "78152",
    "78154",
    "78163",
  ];

  return bexarZips.includes(cleanZip);
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
    deliveryFee?: number;
  };
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
  deliveryFee: number;
  perDayRate: number;
  rentalDays: number;
  extrasTotal: number;
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
  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers,
    {
      deliveryFee: settings?.fees?.deliveryFee,
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
    perDayRate,
    rentalDays,
    extrasTotal,
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
): string {
  const params = new URLSearchParams();
  params.append("bookingId", bookingId);
  params.append("machineType", machineType);

  if (selectedMixers.length > 0) {
    params.append("mixers", selectedMixers.join(","));
  }

  return `/success?${params.toString()}`;
}
