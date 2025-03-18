import { MixerType, mixerDetails, machinePackages } from "./rental-data";

const DELIVERY_FEE = 20;
const SALES_TAX_RATE = 0.0825;
const PROCESSING_FEE_RATE = 0.03;

interface PriceBreakdown {
  basePrice: number;
  mixerPrice: number;
  deliveryFee: number;
  salesTax: number;
  processingFee: number;
  total: number;
}

export function calculatePrice(
  machineType: "single" | "double" | "triple",
  mixerType?: MixerType,
): PriceBreakdown {
  const machine = machinePackages.find((pkg) => pkg.type === machineType);
  if (!machine) {
    throw new Error(`Invalid machine type: ${machineType}`);
  }

  let mixerMultiplier = 1; // Default for single tank
  if (machineType === "double") {
    mixerMultiplier = 2;
  } else if (machineType === "triple") {
    mixerMultiplier = 3;
  }

  const mixerPrice = mixerType
    ? mixerMultiplier * mixerDetails[mixerType].price
    : 0;

  const subtotal = machine.basePrice + mixerPrice + DELIVERY_FEE;
  const salesTax = subtotal * SALES_TAX_RATE;
  const processingFee = subtotal * PROCESSING_FEE_RATE;

  return {
    basePrice: machine.basePrice,
    mixerPrice,
    deliveryFee: DELIVERY_FEE,
    salesTax,
    processingFee,
    total: Number((subtotal + salesTax + processingFee).toFixed(2)),
  };
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}
