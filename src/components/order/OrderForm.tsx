"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { type OrderFormData, type OrderStep, steps } from "./types";
import { calculatePrice, getNextDay, validateDeliveryTime, validateEmail, validatePhone, validateZipCode } from "./utils";
import { ProgressBar } from "./ProgressBar";
import { NavigationButtons } from "./NavigationButtons";
import { DeliveryStep, DetailsStep, ReviewStep, PaymentStep } from "./steps";

export default function OrderForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OrderStep>("delivery");
  const [error, setError] = useState<string | null>(null);

  // Function to get initial form state, used for both initialization and reset
  const getInitialState = (): OrderFormData => {
    const machine = searchParams.get("machine") as "single" | "double";
    const mixer = searchParams.get("mixer") as OrderFormData["mixerType"];

    const initialState: OrderFormData = {
      machineType: machine ?? "single",
      capacity: machine === "double" ? 30 : 15,
      mixerType: mixer ?? "none",
      price: calculatePrice(machine ?? "single", mixer ?? "none"),
      rentalDate: searchParams.get("rentalDate") ?? "",
      rentalTime: searchParams.get("rentalTime") ?? "10:00",
      returnDate: searchParams.get("returnDate") ?? "",
      returnTime: searchParams.get("returnTime") ?? "10:00",
      customer: {
        name: searchParams.get("name") ?? "",
        email: searchParams.get("email") ?? "",
        phone: searchParams.get("phone") ?? "",
        address: {
          street: searchParams.get("street") ?? "",
          city: searchParams.get("city") ?? "",
          state: searchParams.get("state") ?? "",
          zipCode: searchParams.get("zipCode") ?? "",
        },
      },
      notes: searchParams.get("notes") ?? "",
    };

    return initialState;
  };

  // Initialize form state with URL parameters if available
  const [formData, setFormData] = useState<OrderFormData>(getInitialState());

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Update returnDate when rentalDate changes
    if (name === "rentalDate") {
      const nextDay = getNextDay(new Date(value));
      setFormData((prev: OrderFormData) => ({
        ...prev,
        rentalDate: value,
        returnDate: nextDay.toISOString().split("T")[0],
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
      if (name === "machineType" || name === "mixerType") {
        const newPrice = calculatePrice(
          name === "machineType" ? (value as "single" | "double") : prev.machineType,
          name === "mixerType" ? (value as OrderFormData["mixerType"]) : prev.mixerType
        );
        return {
          ...newData,
          price: newPrice,
          capacity: name === "machineType" ? (value === "single" ? 15 : 30) : prev.capacity,
        };
      }

      return newData;
    });
  };

  const handleNextStep = () => {
    // Clear any previous errors
    setError(null);

    // Validate delivery step
    if (step === "delivery") {
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
    }

    const currentIndex = steps.findIndex((s) => s.id === step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1].id);
    }
  };

  const handlePreviousStep = () => {
    const currentIndex = steps.findIndex((s) => s.id === step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1].id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ProgressBar currentStep={step} />

      <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-lg rounded-2xl shadow-xl p-8 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl" />

        {/* Form Steps */}
        {step === "delivery" && (
          <DeliveryStep
            formData={formData}
            onInputChange={handleInputChange}
            error={error}
          />
        )}

        {step === "details" && (
          <DetailsStep
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
          />
        )}

        {step === "payment" && (
          <PaymentStep
            formData={formData}
            onInputChange={handleInputChange}
            error={error}
          />
        )}

        {/* Navigation Buttons */}
        <NavigationButtons
          currentStep={step}
          onPrevious={handlePreviousStep}
          onNext={handleNextStep}
        />
      </div>
    </div>
  );
}
