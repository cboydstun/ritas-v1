import { machinePackages, mixerDetails, MixerType } from "@/lib/rental-data";

export const calculatePrice = (
  machineType: "single" | "double",
  selectedMixers: MixerType[],
): number => {
  // Get base price based on machine type
  const machine = machinePackages.find((m) => m.type === machineType);
  if (!machine) return 89.95; // Default to single tank price

  let totalPrice = machine.basePrice;

  // Add price for each selected mixer
  selectedMixers.forEach((mixer) => {
    totalPrice += mixerDetails[mixer].price;
  });

  return totalPrice;
};

export const getNextDay = (date: Date): Date => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
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

export const validateDeliveryTime = (time: string): boolean => {
  if (!time) return false;
  const [hours, minutes] = time.split(":").map(Number);
  const timeInMinutes = hours * 60 + minutes;
  const minTimeInMinutes = 8 * 60; // 8:00 AM
  const maxTimeInMinutes = 18 * 60; // 6:00 PM
  return timeInMinutes >= minTimeInMinutes && timeInMinutes <= maxTimeInMinutes;
};

interface PricingDetails {
  rentalDays: number;
  perDayRate: number;
  deliveryFee: number;
  subtotal: number;
  salesTax: number;
  processingFee: number;
  total: number;
}

export const calculatePricing = (
  price: number,
  rentalDate: string,
  returnDate: string,
): PricingDetails => {
  const rentalDays = Math.ceil(
    (new Date(returnDate + "T00:00:00").getTime() -
      new Date(rentalDate + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const perDayRate = price;
  const deliveryFee = 20;
  const subtotal = perDayRate * rentalDays + deliveryFee;
  const salesTax = subtotal * 0.0825;
  const processingFee = subtotal * 0.03;
  const total = subtotal + salesTax + processingFee;

  return {
    rentalDays,
    perDayRate,
    deliveryFee,
    subtotal,
    salesTax,
    processingFee,
    total,
  };
};
