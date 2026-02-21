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

export const validateDeliveryTime = (time: string): boolean => {
  if (time === "ANY") return true;
  if (!time) return false;
  const [hours, minutes] = time.split(":").map(Number);
  const timeInMinutes = hours * 60 + minutes;
  const minTimeInMinutes = 8 * 60; // 8:00 AM
  const maxTimeInMinutes = 18 * 60; // 6:00 PM
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

export function computeOrderTotal(formData: OrderFormData): OrderTotals {
  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers,
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
      .reduce(
        (sum, item) => sum + item.price * (item.quantity || 1) * rentalDays,
        0,
      )
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

  const serviceDiscountAmount = Number(
    (formData.isServiceDiscount ? subtotal * 0.1 : 0).toFixed(2),
  );

  const discountedSubtotal = Number(
    (subtotal - serviceDiscountAmount).toFixed(2),
  );

  // Tax and processing fee are applied to the post-discount subtotal
  const salesTax = Number((discountedSubtotal * 0.0825).toFixed(2)); // 8.25%
  const processingFee = Number((discountedSubtotal * 0.03).toFixed(2)); // 3%

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
