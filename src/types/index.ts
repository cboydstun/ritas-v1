export type MachineType = "single" | "double" | "triple";
export type MixerType =
  | "non-alcoholic"
  | "margarita"
  | "pina-colada"
  | "strawberry-daiquiri";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type RentalStatus =
  | "pending"
  | "pending_payment"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled";

export interface CustomerAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
  address: CustomerAddress;
}

export interface Payment {
  paypalTransactionId: string;
  amount: number;
  status: PaymentStatus;
  date: Date;
}

// Import the ExtraItem interface from the order types
import { ExtraItem } from "@/components/order/types";

export interface MargaritaRental {
  _id?: string; // MongoDB document ID
  machineType: MachineType;
  capacity: 15 | 30 | 45;
  selectedMixers: MixerType[];
  selectedExtras?: ExtraItem[]; // Array of extra items with optional quantity
  price: number;
  rentalDate: string;
  rentalTime: string;
  returnDate: string;
  returnTime: string;
  customer: Customer;
  payment?: Payment;
  status: RentalStatus;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  paypalOrderId?: string;
  isServiceDiscount?: boolean; // Flag for service personnel discount
}
