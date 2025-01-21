import mongoose from 'mongoose';
import { MachineType, MixerType, PaymentStatus, RentalStatus } from '@/types';

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true }
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: addressSchema, required: true }
});

const paymentSchema = new mongoose.Schema({
  paypalTransactionId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'] as PaymentStatus[],
    default: 'pending'
  },
  date: { type: Date, required: true }
});

const rentalSchema = new mongoose.Schema({
  machineType: { 
    type: String, 
    required: true,
    enum: ['single', 'double'] as MachineType[]
  },
  capacity: { 
    type: Number, 
    required: true,
    enum: [15, 30]
  },
  mixerType: { 
    type: String, 
    required: true,
    enum: ['none', 'non-alcoholic', 'margarita', 'pina-colada'] as MixerType[]
  },
  price: { 
    type: Number, 
    required: true 
  },
  rentalDate: { 
    type: String, 
    required: true 
  },
  rentalTime: { 
    type: String, 
    required: true 
  },
  returnDate: { 
    type: String, 
    required: true 
  },
  returnTime: { 
    type: String, 
    required: true 
  },
  customer: { 
    type: customerSchema, 
    required: true 
  },
  notes: { 
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'] as RentalStatus[],
    default: 'pending'
  },
  paypalOrderId: {
    type: String
  },
  payment: {
    type: paymentSchema,
    required: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  collection: 'rentals' // Explicitly set collection name
});

// Update timestamps before saving
rentalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Only create the model if it hasn't been created already
export const Rental = mongoose.models.Rental || mongoose.model('Rental', rentalSchema);

export type RentalDocument = mongoose.Document & {
  machineType: MachineType;
  capacity: 15 | 30;
  mixerType: MixerType;
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
