import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global" },
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
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: "" },
  },
  { collection: "settings" },
);

// Validate that delivery window end hour is after start hour
settingsSchema.pre("validate", function (next) {
  const ops = this.operations as
    | { deliveryWindowStartHour: number; deliveryWindowEndHour: number }
    | undefined;
  if (ops && ops.deliveryWindowStartHour >= ops.deliveryWindowEndHour) {
    this.invalidate(
      "operations.deliveryWindowEndHour",
      "deliveryWindowEndHour must be greater than deliveryWindowStartHour",
    );
  }
  next();
});

export type SettingsDocument = mongoose.Document & {
  key: string;
  fees: {
    deliveryFee: number;
    salesTaxRate: number;
    processingFeeRate: number;
    serviceDiscountRate: number;
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
  updatedAt: Date;
  updatedBy: string;
};

export const Settings =
  mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
