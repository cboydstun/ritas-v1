import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    eventDate: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "in-progress", "completed", "archived"],
      default: "new",
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "contacts",
  },
);

// Update timestamps before saving
contactSchema.pre("save", function () {
  this.updatedAt = new Date();
});

// Only create the model if it hasn't been created already
// The admin list sorts the whole collection by recency; without this it was an
// in-memory sort that fails outright at Mongo's 32 MB limit as the collection
// grows. `status` is the other field the triage view filters on.
contactSchema.index({ createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });

export const Contact =
  mongoose.models.Contact || mongoose.model("Contact", contactSchema);

export type ContactDocument = mongoose.Document & {
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  message: string;
  status: "new" | "in-progress" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
};
