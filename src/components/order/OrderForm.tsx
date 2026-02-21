"use client";

import { useState, Suspense, useEffect } from "react";
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
  computeOrderTotal,
} from "./utils";
import { calculatePrice } from "@/lib/pricing";
import { ProgressBar } from "./ProgressBar";
import { NavigationButtons } from "./NavigationButtons";
import { PricingSummary } from "./PricingSummary";

// localStorage key for draft persistence
const DRAFT_KEY = "satx-ritas-order-draft";

// Dynamically import step components with proper typing
const DateSelectionStep = dynamic<StepProps>(
  () => import("./steps/DateSelectionStep").then((mod) => mod.default),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  },
);

const MachineStep = dynamic<StepProps>(
  () => import("./steps/MachineStep").then((mod) => mod.default),
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

  // Get initial machine type and mixer from URL once.
  // If URL params are present (e.g. clicking "Book Now" from the pricing page)
  // we start fresh rather than restoring a previous draft.
  const initialMachineType =
    (searchParams.get("machine") as "single" | "double" | "triple") || "double";
  const initialMixer = searchParams.get("mixer");
  const initialSelectedMixers = initialMixer ? [initialMixer as MixerType] : [];
  const hasUrlParams = searchParams.get("machine") !== null;

  // Initialize form state with URL parameters and optional draft restore
  const capacityMap: Record<string, 15 | 30 | 45> = {
    single: 15,
    double: 30,
    triple: 45,
  };

  const buildDefaultFormData = (): OrderFormData => ({
    machineType: initialMachineType,
    capacity: capacityMap[initialMachineType] ?? 15,
    selectedMixers: initialSelectedMixers,
    selectedExtras: [],
    price: calculatePrice(initialMachineType, initialSelectedMixers).total,
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
        state: "TX", // pre-filled — we only serve Texas
        zipCode: "",
      },
    },
    notes: "",
    // Issue 3: isServiceDiscount lives exclusively in formData (no separate useState)
    isServiceDiscount: false,
  });

  // Attempt to restore a saved draft on first render (client-side only).
  // Draft is ignored when URL params are present (user arrived via a "Book X" link).
  const restoreDraft = (): {
    formData: OrderFormData;
    step: OrderStep;
    hasDraft: boolean;
  } => {
    if (typeof window === "undefined" || hasUrlParams) {
      return {
        formData: buildDefaultFormData(),
        step: "date",
        hasDraft: false,
      };
    }
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          formData?: OrderFormData;
          step?: OrderStep;
        };
        // Only restore if the draft has meaningful progress (a name entered)
        if (parsed.formData?.customer?.name) {
          return {
            formData: { ...buildDefaultFormData(), ...parsed.formData },
            step: parsed.step ?? "date",
            hasDraft: true,
          };
        }
      }
    } catch {
      // ignore malformed draft
    }
    return { formData: buildDefaultFormData(), step: "date", hasDraft: false };
  };

  // Single lazy initialisation so draft + step are consistent from the first render
  const [initialised] = useState(restoreDraft);

  const [step, setStep] = useState<OrderStep>(initialised.step);
  const [formData, setFormData] = useState<OrderFormData>(initialised.formData);
  const [draftRestored, setDraftRestored] = useState(initialised.hasDraft);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Issue 4: changed from useRef to useState so availability errors trigger re-renders
  const [dateAvailabilityError, setDateAvailabilityError] = useState<
    string | null
  >(null);

  // Persist draft to localStorage whenever formData or step changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, step }));
    } catch {
      // ignore (private browsing, quota exceeded, etc.)
    }
  }, [formData, step]);

  // Keep formData.price in sync with the true computed final total.
  // This ensures the price stored in state (and in the localStorage draft) always
  // matches what PricingSummary and ReviewStep display, rather than the stale
  // single-day seed value set at initialisation.
  useEffect(() => {
    const { finalTotal } = computeOrderTotal(formData);
    const rounded = Number(finalTotal.toFixed(2));
    setFormData((prev) =>
      prev.price === rounded ? prev : { ...prev, price: rounded },
    );
    // Only re-run when the fields that actually affect the price change.
    // JSON.stringify the arrays so we don't re-run on every render due to
    // new-but-equal array references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.machineType,
    formData.rentalDate,
    formData.returnDate,
    formData.isServiceDiscount,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(formData.selectedMixers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(formData.selectedExtras),
  ]);

  /** Clear draft — called by ReviewStep just before redirecting to success */
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  // Issue 3: setIsServiceDiscount updates formData directly (no separate state or useEffect)
  const setIsServiceDiscount = (value: boolean) => {
    setFormData((prev) => ({ ...prev, isServiceDiscount: value }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    // Update returnDate when rentalDate changes
    if (name === "rentalDate") {
      // Issue 2: getNextDay now accepts a YYYY-MM-DD string and returns one
      const nextDayString = getNextDay(value);

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

      // Keep capacity in sync when machineType changes directly via this handler
      // (MachineStep also fires a dedicated "capacity" event, but this is a safety net)
      if (name === "machineType") {
        const capacityMap: Record<string, 15 | 30 | 45> = {
          single: 15,
          double: 30,
          triple: 45,
        };
        return {
          ...newData,
          capacity: capacityMap[value] ?? prev.capacity,
        };
      }

      return newData;
    });
  };

  const handleNextStep = () => {
    // Clear any previous errors
    setError(null);

    // Scroll to top so the new step header is visible (especially on mobile)
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Validate date step
    if (step === "date") {
      if (!formData.rentalDate) {
        setError("Please select a delivery date");
        return;
      }
      if (!formData.returnDate) {
        setError("Please select a return date");
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
      if (!formData.returnTime) {
        setError("Please select a pick up time");
        return;
      }
      if (!validateDeliveryTime(formData.returnTime)) {
        setError("Pick up time must be between 8:00 AM and 6:00 PM");
        return;
      }
    }

    // Validate machine step
    if (step === "machine") {
      // Issue 4: dateAvailabilityError is now state, so this also blocks navigation
      if (dateAvailabilityError) {
        setError(dateAvailabilityError);
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
      if (!isBexarCountyZipCode(formData.customer.address.zipCode)) {
        setError(
          "We only deliver within Bexar County, TX. Please enter a valid Bexar County ZIP code, or contact us for special delivery requests.",
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
    const currentIndex = steps.findIndex((s) => s.id === step);
    if (currentIndex > 0) {
      if (step === "review") {
        setAgreedToTerms(false);
      }
      // Scroll to top so the previous step header is visible
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStep(steps[currentIndex - 1].id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Track form step changes */}
      <OrderFormTracker currentStep={step} formData={formData} />

      {/* Draft restored banner */}
      {draftRestored && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex justify-between items-center">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            📋 We restored your previous booking draft — pick up right where you
            left off.
          </p>
          <button
            onClick={() => {
              clearDraft();
              setFormData(buildDefaultFormData());
              setStep("date");
              setDraftRestored(false);
            }}
            className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 underline ml-4 whitespace-nowrap"
          >
            Start fresh
          </button>
        </div>
      )}

      <ProgressBar currentStep={step} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-lg rounded-2xl shadow-xl p-8 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl" />

            {/* Form Steps with Suspense boundary */}
            <Suspense fallback={<StepSkeleton />}>
              {step === "date" && (
                <DateSelectionStep
                  formData={formData}
                  onInputChange={handleInputChange}
                  error={error}
                />
              )}

              {step === "machine" && (
                <MachineStep
                  formData={formData}
                  onInputChange={handleInputChange}
                  // Issue 4: pass availability error so MachineStep shows it immediately
                  error={dateAvailabilityError || error}
                  onAvailabilityError={setDateAvailabilityError}
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
                  // Issue 3: pass setter that updates formData.isServiceDiscount directly
                  setIsServiceDiscount={setIsServiceDiscount}
                  // Clear draft before redirecting to success
                  onSuccess={clearDraft}
                />
              )}
            </Suspense>

            {/* Navigation Buttons */}
            <NavigationButtons
              currentStep={step}
              onPrevious={handlePreviousStep}
              onNext={handleNextStep}
            />
          </div>
        </div>

        {/* Sticky Pricing Summary - Desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-8">
            <PricingSummary formData={formData} currentStep={step} />
          </div>
        </div>

        {/* Mobile Pricing Summary - Shows at bottom */}
        <div className="lg:hidden">
          <PricingSummary formData={formData} currentStep={step} />
        </div>
      </div>
    </div>
  );
}
