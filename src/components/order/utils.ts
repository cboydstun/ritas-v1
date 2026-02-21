export const getNextDay = (dateStr: string): string => {
  // Append T00:00:00 so the date is parsed as local midnight, not UTC midnight
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  /** The true checkout total — tax & fees applied to the multi-day discounted subtotal. */
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
      ? Math.max(
          1,
          Math.ceil(
            (new Date(formData.returnDate + "T00:00:00").getTime() -
              new Date(formData.rentalDate + "T00:00:00").getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1;

  const extrasTotal = Number(
    formData.selectedExtras
      .reduce((sum, item) => {
        const overridePrice = settings?.extras?.[item.id]?.price;
        const unitPrice =
          overridePrice !== undefined ? overridePrice : item.price;
        return sum + unitPrice * (item.quantity || 1) * rentalDays;
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

  // Tax and processing fee are applied to the post-discount subtotal
  const taxRate = settings?.fees?.salesTaxRate ?? 0.0825;
  const processingRate = settings?.fees?.processingFeeRate ?? 0.03;
  const salesTax = Number((discountedSubtotal * taxRate).toFixed(2));
  const processingFee = Number(
    (discountedSubtotal * processingRate).toFixed(2),
  );

  const finalTotal = Number(
    (discountedSubtotal + salesTax + processingFee).toFixed(2),
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
    finalTotal,
  };
}
