import mongoose from "mongoose";
import {
  DEFAULT_INSIDE_ZIPS,
  DEFAULT_OUTSIDE_ZIPS,
} from "@/lib/delivery/defaultZones";
import {
  DEFAULT_TIER_MINIMUMS,
  type TierMinimums,
} from "@/lib/delivery/tierMinimums";
import { DEFAULT_BASE_DELIVERY_FEE } from "@/lib/delivery/deliveryCharge";

const settingsSchema = new mongoose.Schema(
  {
    // Unique: the write path is a `findOneAndUpdate({key:"global"}, …, {upsert:true})`,
    // so two concurrent first-writes could otherwise create two "global"
    // documents and make pricing depend on which one `findOne` returned.
    // `unique` already builds the index — `index: true` on the same path is a
    // duplicate declaration and warns under Mongoose 9.
    key: { type: String, default: "global", unique: true },
    fees: {
      deliveryFee: {
        type: Number,
        default: 20,
        min: [0, "deliveryFee cannot be negative"],
      },
      salesTaxRate: {
        type: Number,
        default: 0.0825,
        min: [0, "salesTaxRate cannot be negative"],
        max: [1, "salesTaxRate cannot exceed 1"],
      },
      processingFeeRate: {
        type: Number,
        default: 0.03,
        min: [0, "processingFeeRate cannot be negative"],
        max: [1, "processingFeeRate cannot exceed 1"],
      },
      serviceDiscountRate: {
        type: Number,
        default: 0.1,
        min: [0, "serviceDiscountRate cannot be negative"],
        max: [1, "serviceDiscountRate cannot exceed 1"],
      },
      // The floor a ZIP falls back to when its fee band carries no minimum of
      // its own. Defaults to 0 — "no floor" — because a minimum nobody has
      // measured refuses real bookings the day it ships.
      minOrderAmount: {
        type: Number,
        default: 0,
        min: [0, "minOrderAmount cannot be negative"],
      },
      // What pinning delivery or pickup to a clock time costs, per leg. A
      // flexible leg (stored as "ANY") is free. See
      // `@/lib/specific-time-charge`, whose DEFAULT_SPECIFIC_TIME_FEE these
      // defaults must match.
      specificDeliveryTimeFee: {
        type: Number,
        default: 25,
        min: [0, "specificDeliveryTimeFee cannot be negative"],
      },
      specificPickupTimeFee: {
        type: Number,
        default: 25,
        min: [0, "specificPickupTimeFee cannot be negative"],
      },
    },
    machines: {
      single: {
        basePrice: {
          type: Number,
          default: 124.95,
          min: [0, "basePrice cannot be negative"],
        },
        inventory: {
          type: Number,
          default: 3,
          min: [0, "inventory cannot be negative"],
        },
      },
      double: {
        basePrice: {
          type: Number,
          default: 149.95,
          min: [0, "basePrice cannot be negative"],
        },
        inventory: {
          type: Number,
          default: 3,
          min: [0, "inventory cannot be negative"],
        },
      },
      triple: {
        basePrice: {
          type: Number,
          default: 174.95,
          min: [0, "basePrice cannot be negative"],
        },
        inventory: {
          type: Number,
          default: 2,
          min: [0, "inventory cannot be negative"],
        },
      },
    },
    mixers: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        "non-alcoholic": {
          label: "Kool Aid Grape or Cherry Mixer",
          description:
            "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Naturally alcohol-free — perfect for all ages.",
          price: 19.95,
        },
        margarita: {
          label: "Margarita Mixer",
          description:
            "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Add your own tequila (max 1.75L/tank) — alcohol not included.",
          price: 19.95,
        },
        "pina-colada": {
          label: "Piña Colada Mixer",
          description:
            "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Add your own rum (max 1.75L/tank) — alcohol not included.",
          price: 24.95,
        },
        "strawberry-daiquiri": {
          label: "Strawberry Daiquiri Mixer",
          description:
            "½ gal concentrate + 2 gal water = ~2.5 gal of drink. Add your own rum (max 1.75L/tank) — alcohol not included.",
          price: 24.95,
        },
      }),
    },
    extras: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        "table-chairs": { price: 19.95 },
        "cotton-candy": { price: 49.95 },
        "bounce-castle": { price: 99.95 },
        "popcorn-machine": { price: 49.95 },
      }),
    },
    operations: {
      deliveryWindowStartHour: {
        type: Number,
        default: 8,
        min: 0,
        max: 23,
      },
      deliveryWindowEndHour: {
        type: Number,
        default: 18,
        min: 0,
        max: 23,
      },
    },
    documentation: {
      pdfUrl: { type: String, default: "" },
      pdfLabel: {
        type: String,
        default: "Download Lease Documentation (PDF)",
      },
    },
    leaseTiers: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        "single-15": {
          monthlyRate: 265,
          placementFee: 100,
          minimumTermMonths: 12,
          bestFor:
            "Smaller restaurants, daiquiri kiosks, and lower-volume bar programs.",
          features: [
            "15L single-tank capacity",
            "One signature flavor on tap",
            "Professional placement & install",
            "Quarterly preventive maintenance",
            "Mixer supply program available",
            "Custom branding option",
          ],
          electrical: "Standard 110V, 15A circuit",
          spaceRequirements: '24" x 24" countertop, 18" overhead clearance',
        },
        "double-30": {
          monthlyRate: 295,
          placementFee: 100,
          minimumTermMonths: 12,
          bestFor:
            "Mexican restaurants, sports bars, and venues serving two flavors at moderate volume.",
          features: [
            "30L dual-tank capacity",
            "Two flavors on tap simultaneously",
            "Professional placement & install",
            "Quarterly preventive maintenance",
            "Mixer supply program available",
            "Custom branding option",
          ],
          electrical: "Dedicated 115V, 20A circuit",
          spaceRequirements: '30" x 24" countertop, 18" overhead clearance',
        },
        "triple-45": {
          monthlyRate: 335,
          placementFee: 100,
          minimumTermMonths: 12,
          bestFor:
            "Hotel resorts, golf courses, drive-thru daiquiri shops, and high-volume venues.",
          features: [
            "45L triple-tank capacity",
            "Three flavors on tap simultaneously",
            "Professional placement & install",
            "Quarterly preventive maintenance",
            "Priority on-site service",
            "Mixer supply program available",
            "Custom branding option",
          ],
          electrical: "Dedicated 115V, 20A circuit",
          spaceRequirements: '36" x 24" countertop, 18" overhead clearance',
        },
      }),
    },
    // Per-ZIP delivery pricing. `customFees` is the only price and the only
    // definition of the service area: a ZIP absent from it is not delivered to,
    // which is a different state from a fee of $0. The two zip lists are
    // geography — a label and a colour on the admin map — and imply no price.
    deliveryZones: {
      customFees: {
        type: Map,
        // `of: Number` alone applies no validator to the values, so a negative
        // fee saved cleanly. The PATCH verbs write through `save()`, so this
        // does fire for them — the zod schema is what guards the `PUT` path.
        of: { type: Number, min: [0, "a delivery fee cannot be negative"] },
        default: () => ({}),
      },
      insideZips: { type: [String], default: () => [...DEFAULT_INSIDE_ZIPS] },
      outsideZips: { type: [String], default: () => [...DEFAULT_OUTSIDE_ZIPS] },
      // Five explicit Number fields rather than a Map, so the schema validates
      // the key set the way `satisfies TierMinimums` does in TypeScript.
      tierMinimums: {
        free: { type: Number, default: DEFAULT_TIER_MINIMUMS.free, min: 0 },
        low: { type: Number, default: DEFAULT_TIER_MINIMUMS.low, min: 0 },
        standard: {
          type: Number,
          default: DEFAULT_TIER_MINIMUMS.standard,
          min: 0,
        },
        high: { type: Number, default: DEFAULT_TIER_MINIMUMS.high, min: 0 },
        premium: {
          type: Number,
          default: DEFAULT_TIER_MINIMUMS.premium,
          min: 0,
        },
      },
      // The flat fee every order pays on top of its ZIP's surcharge. Unlike
      // `tierMinimums` there is deliberately nothing to seed and no
      // self-migration to write: that ladder is a per-band policy decision and
      // had to exist in the stored document, while this is one scalar whose
      // default *is* the policy. A document that has never carried it reads
      // the current price. See `src/lib/delivery/deliveryCharge.ts`.
      baseFee: { type: Number, default: DEFAULT_BASE_DELIVERY_FEE, min: 0 },
    },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: "" },
  },
  { collection: "settings" },
);

// Validate that delivery window end hour is after start hour
settingsSchema.pre("validate", function () {
  const ops = this.operations as
    | { deliveryWindowStartHour: number; deliveryWindowEndHour: number }
    | undefined;
  if (ops && ops.deliveryWindowStartHour >= ops.deliveryWindowEndHour) {
    this.invalidate(
      "operations.deliveryWindowEndHour",
      "deliveryWindowEndHour must be greater than deliveryWindowStartHour",
    );
  }
});

export type SettingsDocument = mongoose.Document & {
  key: string;
  fees: {
    deliveryFee: number;
    salesTaxRate: number;
    processingFeeRate: number;
    serviceDiscountRate: number;
    minOrderAmount: number;
    specificDeliveryTimeFee: number;
    specificPickupTimeFee: number;
  };
  machines: {
    single: { basePrice: number; inventory: number };
    double: { basePrice: number; inventory: number };
    triple: { basePrice: number; inventory: number };
  };
  mixers: Record<string, { label: string; description: string; price: number }>;
  extras: Record<string, { price: number }>;
  operations: {
    deliveryWindowStartHour: number;
    deliveryWindowEndHour: number;
  };
  documentation: {
    pdfUrl: string;
    pdfLabel: string;
  };
  leaseTiers: Record<
    "single-15" | "double-30" | "triple-45",
    {
      monthlyRate: number;
      placementFee: number;
      minimumTermMonths: number;
      bestFor: string;
      features: string[];
      electrical: string;
      spaceRequirements: string;
    }
  >;
  deliveryZones: {
    /** Mongoose hands a server caller a Map here; the browser gets an object. */
    customFees: Map<string, number> | Record<string, number>;
    insideZips: string[];
    outsideZips: string[];
    tierMinimums: TierMinimums;
    baseFee: number;
  };
  updatedAt: Date;
  updatedBy: string;
};

export const Settings =
  mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
