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
      },
      double: {
        basePrice: {
          type: Number,
          default: 149.95,
          min: [0, "basePrice cannot be negative"],
        },
      },
      triple: {
        basePrice: {
          type: Number,
          default: 175.95,
          min: [0, "basePrice cannot be negative"],
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
    single: { basePrice: number };
    double: { basePrice: number };
    triple: { basePrice: number };
  };
  mixers: Record<string, { label: string; description: string; price: number }>;
  extras: Record<string, { price: number }>;
  operations: {
    deliveryWindowStartHour: number;
    deliveryWindowEndHour: number;
  };
  updatedAt: Date;
  updatedBy: string;
};

export const Settings =
  mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
