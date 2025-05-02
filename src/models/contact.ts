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
contactSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Only create the model if it hasn't been created already
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
