import { MixerOption } from "@/lib/rental-data";

export type OrderStep = "delivery" | "details" | "review" | "payment";

export interface OrderFormData {
  machineType: "single" | "double";
  capacity: 15 | 30;
  mixerType: MixerOption["type"];
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
}

export interface StepProps {
  formData: OrderFormData;
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  error: string | null;
  agreedToTerms?: boolean;
  setAgreedToTerms?: (value: boolean) => void;
}

export const steps: { id: OrderStep; label: string }[] = [
  { id: "delivery", label: "Your Delivery" },
  { id: "details", label: "Your Details" },
  { id: "review", label: "Review Order" },
  { id: "payment", label: "Payment" },
];

export const inputClassName =
  "w-full px-4 py-3 bg-white dark:bg-white border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors text-charcoal";
export const labelClassName =
  "block text-charcoal dark:text-white font-medium mb-2";
