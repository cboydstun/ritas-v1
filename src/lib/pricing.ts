import { MixerType, mixerDetails, machinePackages } from "./rental-data";
import type { MachineType } from "@/types";

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
    // `Settings.mixers` is a Mixed map, so Mongoose does not type-check it and
    // documents written before `settingsUpdateSchema` existed can hold a
    // string or null here. `null !== undefined` made a mixer free, and a
    // string concatenated into the running sum and poisoned the subtotal.
    // `buildExtrasCatalog` already guards the same way.
    const overridePrice = overrides?.mixers?.[mixer]?.price;
    const unitPrice =
      typeof overridePrice === "number" && Number.isFinite(overridePrice)
        ? overridePrice
        : (mixerDetails[mixer as MixerType]?.price ?? 0);
    return sum + unitPrice;
  }, 0);

  const subtotal = machineBasePrice + mixerPrice + fee;
  const processingFee = subtotal * processingRate;
  const salesTax = (subtotal + processingFee) * taxRate;

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

/**
 * Effective public prices, with the admin `Settings` overrides applied.
 *
 * `/pricing`, `/order` and `/service-area/[city]` built their visible tables
 * and their machine-readable `Offer` nodes straight from the `rental-data`
 * constants, passing no overrides — while the order wizard and
 * `/api/save-booking` priced from `Settings`. An admin price change therefore
 * left the public pages, the structured data Google indexes, and the actual
 * invoice disagreeing with each other.
 *
 * Pages using this must also export `revalidate` (or `dynamic`), or Next
 * prerenders them and freezes today's prices into the build — the same trap
 * `/long-term-lease` fell into.
 */
export interface PublicPriceTable {
  machineBasePrice: (machineType: MachineType) => number;
  mixerPrice: (mixer: string) => number;
  mixerLabel: (mixer: string) => string;
}

export function publicPriceTable(
  overrides?: Partial<PricingOverrides>,
): PublicPriceTable {
  return {
    machineBasePrice: (machineType) => {
      const override =
        overrides?.machines?.[machineType as "single"]?.basePrice;
      if (typeof override === "number" && Number.isFinite(override)) {
        return override;
      }
      const machine = machinePackages.find((pkg) => pkg.type === machineType);
      return machine?.basePrice ?? 0;
    },
    // Guarded the same way `calculatePrice` is: Settings.mixers is a Mixed
    // map, so a legacy document can hold a string or null here.
    mixerPrice: (mixer) => {
      const override = overrides?.mixers?.[mixer]?.price;
      if (typeof override === "number" && Number.isFinite(override)) {
        return override;
      }
      return mixerDetails[mixer as MixerType]?.price ?? 0;
    },
    mixerLabel: (mixer) => mixerDetails[mixer as MixerType]?.label ?? mixer,
  };
}

/**
 * `priceValidUntil` for a public Offer node, as YYYY-MM-DD.
 *
 * Google treats an Offer without this as potentially stale and may drop the
 * rich result. Lives here rather than inline in the page because reading the
 * clock during a component's render is what `react-hooks/purity` flags, and
 * the pages that need it are server components rendered per revalidate
 * window.
 */
export function offerPriceValidUntil(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
}
