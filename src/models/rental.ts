import mongoose from "mongoose";
import { MachineType, PaymentStatus, RentalStatus } from "@/types";
import { ExtraItem } from "@/components/order/types";

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
  paypalTransactionId: { type: String, required: true },
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
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  allowQuantity: { type: Boolean, default: false },
  quantity: { type: Number, default: 1 },
});

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
    },
    selectedMixers: {
      type: [String],
      enum: [
        "non-alcoholic",
        "margarita",
        "pina-colada",
        "strawberry-daiquiri",
      ],
      validate: [
        {
          validator: function (
            this: mongoose.Document & { machineType: MachineType },
            mixers: string[],
          ) {
            // Single tank can have 0 or 1 mixer
            if (this.machineType === "single") {
              return mixers.length <= 1;
            }
            // Double tank can have 0 to 2 mixers
            if (this.machineType === "double") {
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
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "in-progress",
        "completed",
        "cancelled",
      ] as RentalStatus[],
      default: "pending",
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
rentalSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

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
