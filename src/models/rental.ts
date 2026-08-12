import mongoose from "mongoose";
import { MachineType, PaymentStatus, RentalStatus } from "@/types";
import { ExtraItem } from "@/components/order/types";

/** Tank count per machine type — duplicated from validation.ts to keep the
 *  model free of any dependency on the request-validation layer. */
const MACHINE_CAPACITY: Record<MachineType, number> = {
  single: 15,
  double: 30,
  triple: 45,
};

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: addressSchema, required: true },
});

const paymentSchema = new mongoose.Schema({
  paypalTransactionId: { type: String, required: false }, // Made optional for manual bookings
  amount: { type: Number, required: true },
  status: {
    type: String,
    required: true,
    enum: ["pending", "completed", "failed", "refunded"] as PaymentStatus[],
    default: "pending",
  },
  date: { type: Date, required: true },
});

const extraItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: false },
  price: { type: Number, required: true },
  image: { type: String, required: false },
  allowQuantity: { type: Boolean, default: false },
  quantity: { type: Number, default: 1 },
});

/**
 * The machineType a validator should check against.
 *
 * Document validators get `this` bound to the document; *update* validators
 * (`findByIdAndUpdate(..., { runValidators: true })`) get it bound to the
 * Query, where `this.machineType` is undefined. Reading it directly meant every
 * admin edit that carried `capacity` failed validation and returned a 500.
 */
function machineTypeInContext(context: unknown): MachineType | undefined {
  const ctx = context as {
    machineType?: MachineType;
    getUpdate?: () => Record<string, unknown> | null;
  };
  if (ctx?.machineType) return ctx.machineType;

  const update = ctx?.getUpdate?.() ?? null;
  if (!update) return undefined;
  const set = (update.$set ?? update) as { machineType?: MachineType };
  return set?.machineType;
}

const rentalSchema = new mongoose.Schema(
  {
    machineType: {
      type: String,
      required: true,
      enum: ["single", "double", "triple"] as MachineType[],
    },
    capacity: {
      type: Number,
      required: true,
      enum: [15, 30, 45],
      validate: {
        // Availability is counted per (machineType, capacity) pair, so a
        // mismatched pair matched no existing rentals and slipped past every
        // availability check. The mapping is fixed — enforce it.
        validator: function (capacity: number) {
          const machineType = machineTypeInContext(this);
          // Nothing to check against on a partial update that leaves
          // machineType alone — the pair was already validated when written.
          if (!machineType) return true;
          return MACHINE_CAPACITY[machineType] === capacity;
        },
        message: "Capacity does not match the selected machine type",
      },
    },
    selectedMixers: {
      type: [String],
      validate: [
        {
          validator: function (mixers: string[]) {
            const machineType = machineTypeInContext(this);
            // Single tank can have 0 or 1 mixer
            if (machineType === "single") {
              return mixers.length <= 1;
            }
            // Double tank can have 0 to 2 mixers
            if (machineType === "double") {
              return mixers.length <= 2;
            }
            // Triple tank can have 0 to 3 mixers
            return mixers.length <= 3;
          },
          message: "Selected mixers exceed machine capacity",
        },
      ],
    },
    price: {
      type: Number,
      required: true,
    },
    rentalDate: {
      type: String,
      required: true,
    },
    rentalTime: {
      type: String,
      required: true,
    },
    returnDate: {
      type: String,
      required: true,
    },
    returnTime: {
      type: String,
      required: true,
    },
    customer: {
      type: customerSchema,
      required: true,
    },
    selectedExtras: {
      type: [extraItemSchema],
      default: [],
    },
    notes: {
      type: String,
      default: "",
    },
    isServiceDiscount: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "pending_payment",
        "confirmed",
        "in-progress",
        "completed",
        "cancelled",
      ] as RentalStatus[],
      default: "pending",
    },
    bookingId: {
      type: String,
      required: false,
    },
    paypalOrderId: {
      type: String,
    },
    payment: {
      type: paymentSchema,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "rentals", // Explicitly set collection name
  },
);

// Update timestamps before saving
rentalSchema.pre("save", function () {
  this.updatedAt = new Date();
});

// Availability is the hottest query in the app — MachineStep checks all three
// machine types in parallel on every mount — and it ran as a collection scan.
rentalSchema.index({
  machineType: 1,
  capacity: 1,
  status: 1,
  rentalDate: 1,
  returnDate: 1,
});
rentalSchema.index({ bookingId: 1 }, { sparse: true });
// Drives the stale-hold reaper.
rentalSchema.index({ status: 1, createdAt: 1 });

// Only create the model if it hasn't been created already
export const Rental =
  mongoose.models.Rental || mongoose.model("Rental", rentalSchema);

export type RentalDocument = mongoose.Document & {
  machineType: MachineType;
  capacity: 15 | 30 | 45;
  selectedMixers: string[];
  selectedExtras: ExtraItem[];
  price: number;
  rentalDate: string;
  rentalTime: string;
  returnDate: string;
  returnTime: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  notes: string;
  isServiceDiscount?: boolean;
  status: RentalStatus;
  paypalOrderId?: string;
  payment?: {
    paypalTransactionId: string;
    amount: number;
    status: PaymentStatus;
    date: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};
