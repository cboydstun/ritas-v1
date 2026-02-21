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

export interface PricingOverrides {
  deliveryFee?: number;
  salesTaxRate?: number;
  processingFeeRate?: number;
  machines?: {
    single?: { basePrice: number };
    double?: { basePrice: number };
    triple?: { basePrice: number };
  };
  mixers?: Record<string, { price: number }>;
}

export function calculatePrice(
  machineType: "single" | "double" | "triple",
  mixers: MixerType[] = [],
  overrides?: Partial<PricingOverrides>,
): PriceBreakdown {
  const machine = machinePackages.find((pkg) => pkg.type === machineType);
  if (!machine) {
    throw new Error(`Invalid machine type: ${machineType}`);
  }

  const fee = overrides?.deliveryFee ?? DELIVERY_FEE;
  const taxRate = overrides?.salesTaxRate ?? SALES_TAX_RATE;
  const processingRate = overrides?.processingFeeRate ?? PROCESSING_FEE_RATE;
  const machineBasePrice =
    overrides?.machines?.[machineType]?.basePrice ?? machine.basePrice;

  const mixerPrice = mixers.reduce((sum, mixer) => {
    const overridePrice = overrides?.mixers?.[mixer]?.price;
    const unitPrice =
      overridePrice !== undefined
        ? overridePrice
        : (mixerDetails[mixer as MixerType]?.price ?? 0);
    return sum + unitPrice;
  }, 0);

  const subtotal = machineBasePrice + mixerPrice + fee;
  const salesTax = subtotal * taxRate;
  const processingFee = subtotal * processingRate;

  return {
    basePrice: machineBasePrice,
    mixerPrice,
    deliveryFee: fee,
    salesTax,
    processingFee,
    total: Number((subtotal + salesTax + processingFee).toFixed(2)),
  };
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}
