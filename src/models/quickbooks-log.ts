import mongoose, { Schema, Document } from 'mongoose';

export interface IQuickBooksLog extends Document {
  rentalId: mongoose.Types.ObjectId;
  operation: string;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  errorDetails?: any;
  retryCount: number;
  lastAttempt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuickBooksLogSchema: Schema = new Schema(
  {
    rentalId: {
      type: Schema.Types.ObjectId,
      ref: 'Rental',
      required: true,
    },
    operation: {
      type: String,
      required: true,
      enum: ['createCustomer', 'createItem', 'createInvoice', 'updateInvoice'],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
    },
    errorDetails: {
      type: Schema.Types.Mixed,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
QuickBooksLogSchema.index({ rentalId: 1 });
QuickBooksLogSchema.index({ status: 1 });
QuickBooksLogSchema.index({ lastAttempt: 1 });

export const QuickBooksLog = mongoose.models.QuickBooksLog || 
  mongoose.model<IQuickBooksLog>('QuickBooksLog', QuickBooksLogSchema);
