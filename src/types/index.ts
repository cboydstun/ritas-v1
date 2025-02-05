export type MachineType = "single" | "double";
export type MixerType = "none" | "non-alcoholic" | "margarita" | "pina-colada";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type RentalStatus =
  | "pending"
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

export interface MargaritaRental {
  _id?: string; // MongoDB document ID
  machineType: MachineType;
  capacity: 15 | 30;
  mixerType: MixerType;
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
}
