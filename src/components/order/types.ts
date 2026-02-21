import { MixerType } from "@/lib/rental-data";

export type OrderStep = "date" | "machine" | "details" | "extras" | "review";

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
  isServiceDiscount: boolean;
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
  /** Called just before redirect to success page so the parent can clear the draft */
  onSuccess?: () => void;
  /** Delivery window start hour (0–23), defaults to 8 */
  deliveryWindowStartHour?: number;
  /** Delivery window end hour (0–23), defaults to 18 */
  deliveryWindowEndHour?: number;
  /** Dynamic mixer list from settings; falls back to rental-data defaults when absent */
  mixers?: Array<{
    id: string;
    label: string;
    description: string;
    price: number;
  }>;
}

export const steps: { id: OrderStep; label: string }[] = [
  { id: "date", label: "Select Dates" },
  { id: "machine", label: "Your Machine" },
  { id: "details", label: "Your Details" },
  { id: "extras", label: "Party Extras" },
  { id: "review", label: "Review & Confirm" },
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
