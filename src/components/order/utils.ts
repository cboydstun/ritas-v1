import { buildExtrasCatalog } from "@/lib/extras-catalog";

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
  const toUtcDay = (dateStr: string): number => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  const diffDays = Math.round(
    (toUtcDay(returnDate) - toUtcDay(rentalDate)) / (1000 * 60 * 60 * 24),
  );

  return Number.isFinite(diffDays) ? Math.max(1, diffDays) : 1;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
  return phoneRegex.test(phone);
};

export const validateZipCode = (zipCode: string): boolean => {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
};

export const isBexarCountyZipCode = (zipCode: string): boolean => {
  // Remove any non-digit characters (like dashes)
  const cleanZip = zipCode.replace(/\D/g, "");

  // Main San Antonio/Bexar County ZIP codes
  const bexarZips = [
    // Main San Antonio ZIP ranges (78201-78299)
    ...Array.from({ length: 99 }, (_, i) => `782${String(i).padStart(2, "0")}`),

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

// Format date from YYYY-MM-DD to MM-DD-YYYY
export const formatDateForDisplay = (isoDate: string): string => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
};

// ---------------------------------------------------------------------------
// Centralised order-total calculation
// Used by PricingSummary, ReviewStep, and OrderForm to ensure a single source
// of truth for all pricing maths.
// ---------------------------------------------------------------------------

import { calculatePrice } from "@/lib/pricing";
import { OrderFormData } from "./types";

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

  const extrasTotal = Number(
    formData.selectedExtras
      .reduce((sum, item) => {
        const catalogItem = extrasCatalog.get(item.id);
        if (!catalogItem) return sum;

        const quantity = catalogItem.allowQuantity
          ? Math.max(1, Math.floor(Number(item.quantity) || 1))
          : 1;
        const multiplier = catalogItem.pricingType === "flat" ? 1 : rentalDays;
        return sum + catalogItem.price * quantity * multiplier;
      }, 0)
      .toFixed(2),
  );

  // Subtotal = machine rate × days + delivery + extras
  const subtotal = Number(
    (
      perDayRate * rentalDays +
      priceBreakdown.deliveryFee +
      extrasTotal
    ).toFixed(2),
  );

  const discountRate = settings?.fees?.serviceDiscountRate ?? 0.1;
  const serviceDiscountAmount = Number(
    (formData.isServiceDiscount ? subtotal * discountRate : 0).toFixed(2),
  );

  const discountedSubtotal = Number(
    (subtotal - serviceDiscountAmount).toFixed(2),
  );

  // Matches the QuickBooks invoice: processing fee is a taxable line item, so
  // sales tax is applied to (discountedSubtotal + processingFee).
  const taxRate = settings?.fees?.salesTaxRate ?? 0.0825;
  const processingRate = settings?.fees?.processingFeeRate ?? 0.03;
  const processingFee = Number(
    (discountedSubtotal * processingRate).toFixed(2),
  );
  const salesTax = Number(
    ((discountedSubtotal + processingFee) * taxRate).toFixed(2),
  );

  // Cash Price = what a customer pays when settling in cash on delivery (no
  // card-processing fee, tax on subtotal only). Mirrors QB's "Cash Price" line.
  const cashPrice = Number(
    (discountedSubtotal + discountedSubtotal * taxRate).toFixed(2),
  );

  const finalTotal = Number(
    (discountedSubtotal + processingFee + salesTax).toFixed(2),
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
