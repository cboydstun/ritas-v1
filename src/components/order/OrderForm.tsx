"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import OrderFormTracker from "./OrderFormTracker";
import { MixerType, machinePackages } from "@/lib/rental-data";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  type OrderFormData,
  type OrderStep,
  type StepProps,
  steps,
} from "./types";
import { buildExtrasCatalog, buildMixerCatalog } from "@/lib/extras-catalog";
import { todayLocalIso } from "@/lib/dates";
import {
  getNextDay,
  validateDeliveryTime,
  validateEmail,
  validatePhone,
  validateZipCode,
  isBexarCountyZipCode,
  computeOrderTotal,
  type SettingsOverrides,
} from "./utils";
import { calculatePrice } from "@/lib/pricing";
import { ProgressBar } from "./ProgressBar";
import { NavigationButtons } from "./NavigationButtons";
import { PricingSummary } from "./PricingSummary";

// localStorage key for draft persistence
const DRAFT_KEY = "satx-ritas-order-draft";

/** Bumped whenever the draft shape changes; a mismatch discards the draft. */
const DRAFT_VERSION = 1;

/**
 * The one place a machine type coming from outside the app is checked.
 *
 * Both untrusted sources — the `?machine=` query param and a restored
 * localStorage draft — feed `calculatePrice`, which throws rather than
 * defaulting on an unknown type.
 */
const isMachineTypeValue = (
  value: unknown,
): value is "single" | "double" | "triple" =>
  typeof value === "string" && machinePackages.some((p) => p.type === value);

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
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-sm w-3/4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-sm w-5/6"></div>
    </div>
  </div>
);

export default function OrderForm() {
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<SettingsOverrides>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsFailed, setSettingsFailed] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings")
      .then((res) => {
        // The route answers `{ message }` with a 500 when the DB is down.
        // Storing that object as `settings` made every field read undefined,
        // so the wizard quoted hardcoded defaults while the server invoiced
        // from the real overrides.
        if (!res.ok) throw new Error("settings unavailable");
        return res.json();
      })
      .then((data: SettingsOverrides) => {
        setSettings(data);
        // Draft pruning below has to wait for the real catalog. Pruning
        // against the empty default would drop every admin-added extra from a
        // draft — which is what setting this in `.finally()` did, because
        // `.finally()` also runs on the `.catch()` path.
        setSettingsLoaded(true);
      })
      .catch(() => {
        // Defaults are kept, but they are not the prices the server will
        // invoice from, so the customer is told rather than quietly shown a
        // total that will not match their invoice.
        setSettingsFailed(true);
      });
  }, []);

  // Build ordered mixer list from settings for MachineStep
  const settingsMixers = settings.mixers
    ? Object.entries(settings.mixers).map(([id, m]) => ({
        id,
        label: m.label ?? id,
        description: m.description ?? "",
        price: m.price,
      }))
    : undefined;

  const deliveryWindowStartHour =
    settings?.operations?.deliveryWindowStartHour ?? 8;
  const deliveryWindowEndHour =
    settings?.operations?.deliveryWindowEndHour ?? 18;

  // Get initial machine type and mixer from URL once.
  // If URL params are present (e.g. clicking "Book Now" from the pricing page)
  // we start fresh rather than restoring a previous draft.
  // `calculatePrice` throws on an unknown machine type, and it is called from
  // the `useState` initialiser below — so an unvalidated cast here meant
  // /order?machine=quad (or ?machine=Double — wrong case is enough) threw
  // during render and dropped the whole conversion page into the error
  // boundary. No internal link emits this param; ads and bots do.
  const initialMachineType = isMachineTypeValue(searchParams.get("machine"))
    ? (searchParams.get("machine") as "single" | "double" | "triple")
    : "double";
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

  // A step name written by an older deploy is not a step name now. Restoring
  // it unchecked left ProgressBar indexing `steps[-1]`, which threw on render
  // and bricked the order page until localStorage was cleared by hand.
  const isOrderStep = (value: unknown): value is OrderStep =>
    typeof value === "string" && steps.some((s) => s.id === value);

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
          version?: number;
          formData?: OrderFormData;
          step?: OrderStep;
        };
        // A draft written by an older shape is discarded rather than merged.
        // Drafts predating the version field have no `version` at all.
        if (parsed.version !== DRAFT_VERSION) {
          localStorage.removeItem(DRAFT_KEY);
          return {
            formData: buildDefaultFormData(),
            step: "date",
            hasDraft: false,
          };
        }
        // Only restore if the draft has meaningful progress (a name entered)
        if (parsed.formData?.customer?.name) {
          const defaults = buildDefaultFormData();
          // `customer` and `customer.address` are merged field by field. A
          // plain spread replaced them wholesale, so a draft written by an
          // older schema (one without `customer.address`) made DetailsStep
          // throw on `customer.address.street` and bricked the order page
          // until the visitor cleared localStorage.
          const merged: OrderFormData = {
            ...defaults,
            ...parsed.formData,
            customer: {
              ...defaults.customer,
              ...parsed.formData.customer,
              address: {
                ...defaults.customer.address,
                ...parsed.formData.customer?.address,
              },
            },
          };

          // `machineType`, `capacity` and the two arrays were restored by the
          // spread above with no checking at all. A draft carrying an unknown
          // machine type threw out of `calculatePrice` in both the price-sync
          // effect and PricingSummary's render, and "Try again" re-read the
          // same draft — so the order page was bricked until the visitor
          // cleared localStorage themselves. A non-array selection threw the
          // same way at `.filter` in the prune effect.
          if (!isMachineTypeValue(merged.machineType)) {
            merged.machineType = defaults.machineType;
            merged.selectedMixers = [];
          }
          merged.capacity = capacityMap[merged.machineType] ?? 15;
          if (!Array.isArray(merged.selectedMixers)) merged.selectedMixers = [];
          if (!Array.isArray(merged.selectedExtras)) merged.selectedExtras = [];

          // A draft outlives the day it was written on. Restoring a past
          // rental date left it selected (the picker only disables past days
          // for *new* clicks) and the visitor walked all the way to review
          // before /api/save-booking answered "Rental date cannot be in the
          // past" — after firing availability checks for dates in the past.
          let step = isOrderStep(parsed.step) ? parsed.step : "date";
          if (merged.rentalDate && merged.rentalDate < todayLocalIso()) {
            merged.rentalDate = "";
            merged.returnDate = "";
            step = "date";
          }

          return { formData: merged, step, hasDraft: true };
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
  // Skips the first run, so landing on /order does not yank focus.
  const hasMovedStep = useRef(false);
  const [dateAvailabilityError, setDateAvailabilityError] = useState<
    string | null
  >(null);
  // True while MachineStep still has availability requests in flight. Without
  // it, every card read as selectable and the customer could walk to review on
  // a machine the server was about to refuse with a 409.
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Persist draft to localStorage whenever formData or step changes
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ version: DRAFT_VERSION, formData, step }),
      );
    } catch {
      // ignore (private browsing, quota exceeded, etc.)
    }
  }, [formData, step]);

  // Keep formData.price in sync with the true computed final total.
  // This ensures the price stored in state (and in the localStorage draft) always
  // matches what PricingSummary and ReviewStep display, rather than the stale
  // single-day seed value set at initialisation.
  useEffect(() => {
    const { finalTotal } = computeOrderTotal(formData, settings);
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
    settings,
  ]);

  // A draft can also outlive the catalog it was written against: when an admin
  // removes a mixer flavour, its `mixer-<id>` add-on is orphaned. Every
  // renderer skips an unknown id and computeOrderTotal ignores it, but
  // ReviewStep still posts it and /api/save-booking rejects the whole booking
  // — leaving the customer a 400 with no visible line item to uncheck. Drop
  // orphans as soon as the real catalog is known.
  useEffect(() => {
    if (!settingsLoaded) return;

    const extrasCatalog = buildExtrasCatalog({
      extras: settings.extras,
      mixers: settings.mixers,
    });
    const mixerCatalog = buildMixerCatalog({ mixers: settings.mixers });

    setFormData((prev) => {
      const selectedExtras = prev.selectedExtras.filter((item) =>
        extrasCatalog.has(item.id),
      );
      const selectedMixers = prev.selectedMixers.filter((mixer) =>
        mixerCatalog.has(mixer),
      );

      if (
        selectedExtras.length === prev.selectedExtras.length &&
        selectedMixers.length === prev.selectedMixers.length
      ) {
        return prev;
      }
      return { ...prev, selectedExtras, selectedMixers };
    });
  }, [settingsLoaded, settings]);

  /** Clear draft — called by ReviewStep just before redirecting to success */
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    // Update returnDate when rentalDate changes
    if (name === "rentalDate" || name === "returnDate") {
      // A "fully booked" message belongs to the dates that produced it. It
      // was never cleared, so picking a different week and returning to the
      // machine step re-rendered the old message against the new dates —
      // MachineStep's derive effect early-returns while the fresh checks are
      // still in flight, so nothing overwrote it in the meantime.
      setDateAvailabilityError(null);
    }

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

  // Bring a validation error into view. Every step renders its banner at the
  // bottom, so a failed "Next" was otherwise silent to anyone who had scrolled.
  useEffect(() => {
    if (!error) return;
    document
      .querySelector('[role="alert"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const handleNextStep = () => {
    // Clear any previous errors
    setError(null);

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
      if (
        !validateDeliveryTime(
          formData.rentalTime,
          deliveryWindowStartHour,
          deliveryWindowEndHour,
        )
      ) {
        const startLabel =
          deliveryWindowStartHour < 12
            ? `${deliveryWindowStartHour}:00 AM`
            : `${deliveryWindowStartHour - 12 || 12}:00 PM`;
        const endLabel =
          deliveryWindowEndHour < 12
            ? `${deliveryWindowEndHour}:00 AM`
            : `${deliveryWindowEndHour - 12 || 12}:00 PM`;
        setError(`Delivery time must be between ${startLabel} and ${endLabel}`);
        return;
      }
      if (!formData.returnTime) {
        setError("Please select a pick up time");
        return;
      }
      if (
        !validateDeliveryTime(
          formData.returnTime,
          deliveryWindowStartHour,
          deliveryWindowEndHour,
        )
      ) {
        const startLabel =
          deliveryWindowStartHour < 12
            ? `${deliveryWindowStartHour}:00 AM`
            : `${deliveryWindowStartHour - 12 || 12}:00 PM`;
        const endLabel =
          deliveryWindowEndHour < 12
            ? `${deliveryWindowEndHour}:00 AM`
            : `${deliveryWindowEndHour - 12 || 12}:00 PM`;
        setError(`Pick up time must be between ${startLabel} and ${endLabel}`);
        return;
      }
    }

    // Validate machine step
    if (step === "machine") {
      if (checkingAvailability) {
        setError("Still checking availability for your dates — one moment.");
        return;
      }
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
      // Only scroll to the top once validation has passed. Doing it first sent
      // the user to the header of a long step while the reason "Next" failed
      // was still rendered off-screen at the bottom.
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStep(steps[currentIndex + 1].id);
    }
  };

  // Focus moves to the step container on every transition. Advancing only
  // scrolled, so a keyboard or screen-reader user got no signal that the
  // content had changed — the wizard never navigates, and ProgressBar updated
  // silently.
  const stepHeadingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMovedStep.current) {
      hasMovedStep.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

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

      {/* Pricing could not be confirmed against the server */}
      {settingsFailed && (
        <div
          role="alert"
          className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg"
        >
          <p className="text-sm text-amber-800 dark:text-amber-300">
            ⚠️ We couldn&apos;t confirm current pricing just now, so the totals
            below are our standard rates. Your invoice is calculated on our
            server and is the figure that counts — we&apos;ll confirm it with
            you before anything is due.
          </p>
        </div>
      )}

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
            <div ref={stepHeadingRef} tabIndex={-1} className="outline-hidden">
              <Suspense fallback={<StepSkeleton />}>
                {step === "date" && (
                  <DateSelectionStep
                    formData={formData}
                    onInputChange={handleInputChange}
                    error={error}
                    deliveryWindowStartHour={deliveryWindowStartHour}
                    deliveryWindowEndHour={deliveryWindowEndHour}
                  />
                )}

                {step === "machine" && (
                  <MachineStep
                    formData={formData}
                    onInputChange={handleInputChange}
                    // Issue 4: pass availability error so MachineStep shows it immediately
                    error={dateAvailabilityError || error}
                    onAvailabilityError={setDateAvailabilityError}
                    onAvailabilityChecking={setCheckingAvailability}
                    mixers={settingsMixers}
                    settings={settings}
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
                    settings={settings}
                  />
                )}

                {step === "review" && (
                  <ReviewStep
                    formData={formData}
                    onInputChange={handleInputChange}
                    error={error}
                    agreedToTerms={agreedToTerms}
                    setAgreedToTerms={setAgreedToTerms}
                    // Without this the review total ignores admin pricing
                    // overrides and disagrees with the sidebar and the invoice.
                    settings={settings}
                    // Clear draft before redirecting to success
                    onSuccess={clearDraft}
                  />
                )}
              </Suspense>
            </div>

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
            <PricingSummary
              formData={formData}
              currentStep={step}
              settings={settings}
            />
          </div>
        </div>

        {/* Mobile Pricing Summary - Shows at bottom */}
        <div className="lg:hidden">
          <PricingSummary
            formData={formData}
            currentStep={step}
            settings={settings}
          />
        </div>
      </div>
    </div>
  );
}
