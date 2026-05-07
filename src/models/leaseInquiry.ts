import mongoose from "mongoose";
import {
  LEASE_BUSINESS_TYPES,
  LEASE_TERMS,
  type LeaseBusinessType,
  type LeaseTerm,
  type LeaseTierId,
} from "@/lib/lease-data";

const leaseInquirySchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    businessType: {
      type: String,
      required: true,
      enum: [...LEASE_BUSINESS_TYPES],
    },
    contactName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
    },
    preferredTerm: {
      type: String,
      required: true,
      enum: [...LEASE_TERMS],
    },
    machinesOfInterest: [
      {
        type: String,
        enum: ["single-15", "double-30", "triple-45"],
      },
    ],
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "won", "lost", "archived"],
      default: "new",
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "lease_inquiries",
  },
);

leaseInquirySchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const LeaseInquiry =
  mongoose.models.LeaseInquiry ||
  mongoose.model("LeaseInquiry", leaseInquirySchema);

export type LeaseInquiryDocument = mongoose.Document & {
  businessName: string;
  businessType: LeaseBusinessType;
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  preferredTerm: LeaseTerm;
  machinesOfInterest: LeaseTierId[];
  message: string;
  status: "new" | "contacted" | "qualified" | "won" | "lost" | "archived";
  createdAt: Date;
  updatedAt: Date;
};
