import { MixerType } from "@/lib/rental-data";

export type OrderStep =
  | "delivery"
  | "details"
  | "extras"
  | "review"
  | "payment";

export interface ExtraItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  allowQuantity?: boolean;
  quantity?: number;
}

export interface OrderFormData {
  machineType: "single" | "double" | "triple";
  capacity: 15 | 30 | 45;
  selectedMixers: MixerType[];
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
  isServiceDiscount?: boolean;
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
  onAvailabilityError?: (errorMsg: string | null) => void;
  isServiceDiscount?: boolean;
  setIsServiceDiscount?: (value: boolean) => void;
}

export const steps: { id: OrderStep; label: string }[] = [
  { id: "delivery", label: "Your Delivery" },
  { id: "details", label: "Your Details" },
  { id: "extras", label: "Party Extras" },
  { id: "review", label: "Review Order" },
  { id: "payment", label: "Payment" },
];

export const extraItems: ExtraItem[] = [
  {
    id: "table-chairs",
    name: "Table & Chairs Set",
    description: "Six foot folding table with six folding chairs",
    price: 19.95,
    image: "/table-and-chairs-satx-ritas.webp",
    allowQuantity: true,
    quantity: 1,
  },
  {
    id: "cotton-candy",
    name: "Cotton Candy Machine",
    description:
      "Cotton Candy Machine with 50 servings including pink vanilla and blue raspberry",
    price: 49.95,
    image: "/cotton-candy-satx-ritas.webp",
  },
  {
    id: "bounce-castle",
    name: "Inflatable Bounce Castle",
    description: "An inflatable bounce castle for kids",
    price: 99.95,
    image: "/bounce-house-satx-ritas.webp",
  },
  {
    id: "popcorn-machine",
    name: "Popcorn Machine",
    description: "Popcorn machine with at least 100 servings",
    price: 49.95,
    image: "/popcorn-machine-satx-ritas.webp",
  },
];

export const inputClassName =
  "w-full px-4 py-3 bg-white dark:bg-white border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors text-charcoal";
export const labelClassName =
  "block text-charcoal dark:text-white font-medium mb-2";
