import mongoose from "mongoose";

// Schema for variables that can be used in templates
const variableSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  defaultValue: { type: String, required: false },
});

// Schema for email templates
const emailTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    subject: { type: String, required: true },
    body: { type: String, required: true }, // HTML content
    variables: { type: [variableSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "emailTemplates",
  }
);

// Schema for sent emails
const sentEmailSchema = new mongoose.Schema(
  {
    templateId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'EmailTemplate',
      required: false // Allow null for custom one-off emails
    },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: [String], required: true },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    status: { 
      type: String, 
      enum: ['sent', 'failed', 'delivered', 'bounced'],
      default: 'sent'
    },
    resendId: { type: String, required: true }, // ID returned by Resend
    metadata: { type: Map, of: String, default: {} }, // For additional data
    sentAt: { type: Date, default: Date.now },
  },
  {
    collection: "sentEmails",
  }
);

// Update timestamps before saving
emailTemplateSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Define TypeScript interfaces
export interface IVariable {
  name: string;
  description: string;
  defaultValue?: string;
}

export interface IEmailTemplate extends mongoose.Document {
  name: string;
  description?: string;
  subject: string;
  body: string;
  variables: IVariable[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISentEmail extends mongoose.Document {
  templateId?: mongoose.Types.ObjectId;
  subject: string;
  body: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  status: 'sent' | 'failed' | 'delivered' | 'bounced';
  resendId: string;
  metadata: Map<string, string>;
  sentAt: Date;
}

// Only create the models if they haven't been created already
export const EmailTemplate =
  mongoose.models.EmailTemplate ||
  mongoose.model<IEmailTemplate>("EmailTemplate", emailTemplateSchema);

export const SentEmail =
  mongoose.models.SentEmail ||
  mongoose.model<ISentEmail>("SentEmail", sentEmailSchema);
