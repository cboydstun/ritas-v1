"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import OrderFormTracker from "./OrderFormTracker";
import { MixerType } from "@/lib/rental-data";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  type OrderFormData,
  type OrderStep,
  type StepProps,
  steps,
} from "./types";
import {
  getNextDay,
  validateDeliveryTime,
  validateEmail,
  validatePhone,
  validateZipCode,
  isBexarCountyZipCode,
} from "./utils";
import { calculatePrice } from "@/lib/pricing";
import { ProgressBar } from "./ProgressBar";
import { NavigationButtons } from "./NavigationButtons";

// Dynamically import step components with proper typing
const DeliveryStep = dynamic<StepProps>(
  () => import("./steps/DeliveryStep").then((mod) => mod.default),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  },
);

const DetailsStep = dynamic<StepProps>(
  () => import("./steps/DetailsStep").then((mod) => mod.default),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  },
);

const ExtrasStep = dynamic<StepProps>(
  () => import("./steps/ExtrasStep").then((mod) => mod.default),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  },
);

const ReviewStep = dynamic<StepProps>(
  () => import("./steps/ReviewStep").then((mod) => mod.default),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  },
);

const PaymentStep = dynamic<StepProps>(
  () => import("./steps/PaymentStep").then((mod) => mod.default),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  },
);

// Loading skeleton for step components
const StepSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  </div>
);

export default function OrderForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OrderStep>("delivery");
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const dateAvailabilityErrorRef = useRef<string | null>(null);
  const [nextButtonClickCount, setNextButtonClickCount] = useState<number>(0);

  // Get initial machine type and mixer from URL once
  const initialMachineType =
    (searchParams.get("machine") as "single" | "double" | "triple") || "single";
  const initialMixer = searchParams.get("mixer");
  const initialSelectedMixers = initialMixer ? [initialMixer as MixerType] : [];

  // Initialize form state with URL parameters
  const [formData, setFormData] = useState<OrderFormData>({
    machineType: initialMachineType,
    capacity: initialMachineType === "double" ? 30 : 15,
    selectedMixers: initialSelectedMixers,
    selectedExtras: [],
    price: calculatePrice(initialMachineType, initialSelectedMixers[0]).total,
    rentalDate: "",
    rentalTime: "ANY",
    returnDate: "",
    returnTime: "ANY",
    customer: {
      name: "",
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
      },
    },
    notes: "",
  });

  // Helper function to calculate rental days - used in handleInputChange
  const calculateRentalDays = (
    rentalDate: string,
    returnDate: string,
  ): number => {
    if (!rentalDate || !returnDate) return 1;

    const days = Math.ceil(
      (new Date(returnDate).getTime() - new Date(rentalDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Always return at least 1 day
    return Math.max(1, days);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    // Update returnDate when rentalDate changes
    if (name === "rentalDate") {
      const nextDay = getNextDay(new Date(value));
      const nextDayString = nextDay.toISOString().split("T")[0];

      // Use calculateRentalDays to get the rental duration
      const days = calculateRentalDays(value, nextDayString);
      console.log(`Rental duration: ${days} day(s)`);

      setFormData((prev: OrderFormData) => ({
        ...prev,
        rentalDate: value,
        returnDate: nextDayString,
      }));
      return;
    }

    // Handle nested address fields
    if (name.startsWith("customer.address.")) {
      const field = name.split(".")[2]; // Get the address field name
      setFormData((prev: OrderFormData) => ({
        ...prev,
        customer: {
          ...prev.customer,
          address: {
            ...prev.customer.address,
            [field]: value,
          },
        },
      }));
      return;
    }

    // Handle other customer fields
    if (name.startsWith("customer.")) {
      const field = name.split(".")[1];
      setFormData((prev: OrderFormData) => ({
        ...prev,
        customer: {
          ...prev.customer,
          [field]: value,
        },
      }));
      return;
    }

    // Handle all other fields
    setFormData((prev: OrderFormData) => {
      const newData = { ...prev, [name]: value };

      // Update price when machine type or mixer type changes
      if (name === "machineType" || name === "selectedMixers") {
        const newPrice = calculatePrice(
          name === "machineType"
            ? (value as "single" | "double" | "triple")
            : prev.machineType,
          name === "selectedMixers"
            ? (value as unknown as MixerType[])[0]
            : prev.selectedMixers[0],
        ).total;

        // Update capacity based on machine type
        let newCapacity = prev.capacity;
        if (name === "machineType") {
          if (value === "single") {
            newCapacity = 15;
          } else if (value === "double") {
            newCapacity = 30;
          } else if (value === "triple") {
            newCapacity = 45;
          }
        }

        return {
          ...newData,
          price: newPrice,
          capacity: newCapacity,
        };
      }

      return newData;
    });
  };

  // Reset click counter when component mounts or when step changes
  useEffect(() => {
    setNextButtonClickCount(0);
  }, [step]);

  const handleNextStep = () => {
    // Increment the click counter
    setNextButtonClickCount((prevCount) => prevCount + 1);

    // Clear any previous errors
    setError(null);

    // Reset agreedToTerms when moving away from review step
    if (step !== "review") {
      setAgreedToTerms(false);
    }

    // Validate delivery step
    if (step === "delivery") {
      // Check for availability error first
      if (dateAvailabilityErrorRef.current) {
        setError(dateAvailabilityErrorRef.current);
        return;
      }

      if (!formData.rentalDate) {
        setError("Please select a delivery date");
        return;
      }
      if (!formData.rentalTime) {
        setError("Please select a delivery time");
        return;
      }
      if (!validateDeliveryTime(formData.rentalTime)) {
        setError("Delivery time must be between 8:00 AM and 6:00 PM");
        return;
      }
      if (!formData.returnDate) {
        setError("Please select a pick up date");
        return;
      }
      if (!formData.returnTime) {
        setError("Please select a pick up time");
        return;
      }
      if (!validateDeliveryTime(formData.returnTime)) {
        setError("Pick up time must be between 8:00 AM and 6:00 PM");
        return;
      }
    }

    // Validate details step
    if (step === "details") {
      if (!formData.customer.name.trim()) {
        setError("Please enter your full name");
        return;
      }
      if (!formData.customer.email) {
        setError("Please enter your email address");
        return;
      }
      if (!validateEmail(formData.customer.email)) {
        setError("Please enter a valid email address");
        return;
      }
      if (!formData.customer.phone) {
        setError("Please enter your phone number");
        return;
      }
      if (!validatePhone(formData.customer.phone)) {
        setError("Please enter a valid phone number (e.g., 123-456-7890)");
        return;
      }
      if (!formData.customer.address.street) {
        setError("Please enter your street address");
        return;
      }
      if (!formData.customer.address.city) {
        setError("Please enter your city");
        return;
      }
      if (!formData.customer.address.state) {
        setError("Please enter your state");
        return;
      }
      if (!formData.customer.address.zipCode) {
        setError("Please enter your ZIP code");
        return;
      }
      if (!validateZipCode(formData.customer.address.zipCode)) {
        setError("Please enter a valid ZIP code (e.g., 12345 or 12345-6789)");
        return;
      }
      // Check if we should bypass ZIP code validation (after 5 clicks)
      const shouldBypassZipValidation = nextButtonClickCount >= 5;

      if (
        !shouldBypassZipValidation &&
        !isBexarCountyZipCode(formData.customer.address.zipCode)
      ) {
        setError(
          "We only deliver within Bexar County, TX. Please enter a valid Bexar County ZIP code.",
        );
        return;
      }
    }

    const currentIndex = steps.findIndex((s) => s.id === step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1].id);
    }
  };

  const handlePreviousStep = () => {
    // Reset the click counter when going back
    setNextButtonClickCount(0);

    const currentIndex = steps.findIndex((s) => s.id === step);
    if (currentIndex > 0) {
      if (step === "review") {
        setAgreedToTerms(false);
      }
      setStep(steps[currentIndex - 1].id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Track form step changes */}
      <OrderFormTracker currentStep={step} formData={formData} />

      <ProgressBar currentStep={step} />

      <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-lg rounded-2xl shadow-xl p-8 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl" />

        {/* Form Steps with Suspense boundary */}
        <Suspense fallback={<StepSkeleton />}>
          {step === "delivery" && (
            <DeliveryStep
              formData={formData}
              onInputChange={handleInputChange}
              error={error}
              onAvailabilityError={(errorMsg) => {
                dateAvailabilityErrorRef.current = errorMsg;
              }}
            />
          )}

          {step === "details" && (
            <DetailsStep
              formData={formData}
              onInputChange={handleInputChange}
              error={error}
            />
          )}

          {step === "extras" && (
            <ExtrasStep
              formData={formData}
              onInputChange={handleInputChange}
              error={error}
            />
          )}

          {step === "review" && (
            <ReviewStep
              formData={formData}
              onInputChange={handleInputChange}
              error={error}
              agreedToTerms={agreedToTerms}
              setAgreedToTerms={setAgreedToTerms}
            />
          )}

          {step === "payment" && (
            <PaymentStep
              formData={formData}
              onInputChange={handleInputChange}
              error={error}
            />
          )}
        </Suspense>

        {/* Navigation Buttons */}
        <NavigationButtons
          currentStep={step}
          onPrevious={handlePreviousStep}
          onNext={handleNextStep}
          isNextDisabled={step === "review" && !agreedToTerms}
        />
      </div>
    </div>
  );
}
