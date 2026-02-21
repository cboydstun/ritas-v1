import { ChangeEvent, useState, useEffect } from "react";
import { StepProps } from "../types";
import { mixerDetails, machinePackages, MixerType } from "@/lib/rental-data";
import { format } from "date-fns";
import MachineCard from "./MachineCard";
import MixerCard from "./MixerCard";
import { useAvailabilityCheck } from "@/hooks/useAvailabilityCheck";

// Define the sub-steps for the machine step
enum MachineSubStep {
  MachineType = 0,
  Mixer = 1,
  NextButton = 2,
}

const defaultMixerTypes: MixerType[] = [
  "non-alcoholic",
  "margarita",
  "pina-colada",
  "strawberry-daiquiri",
];

// Machine images and extended config
const machineImages: Record<string, string> = {
  single: "/vevor-15l-slushy.jpg",
  double: "/vevor-30l-slushy.png",
  triple: "/vevor-45l-slushy-2.png",
};

const machineGuestRanges: Record<string, { min: number; max: number }> = {
  single: { min: 10, max: 30 },
  double: { min: 20, max: 60 },
  triple: { min: 40, max: 90 },
};

const machinePopular: Record<string, boolean> = {
  single: false,
  double: true,
  triple: false,
};

export default function MachineStep({
  formData,
  onInputChange,
  error,
  onAvailabilityError,
  mixers: mixersProp,
}: StepProps) {
  // Use DB-driven mixer list when available, fall back to rental-data defaults
  const resolvedMixers =
    mixersProp ??
    defaultMixerTypes.map((t) => ({
      id: t,
      label: mixerDetails[t].label,
      description: mixerDetails[t].description,
      price: mixerDetails[t].price,
    }));
  // Track the current sub-step
  const [currentSubStep, setCurrentSubStep] = useState<MachineSubStep>(
    MachineSubStep.MachineType,
  );
  // Soft warning shown when the availability API fails (network/server error)
  // — does NOT block navigation, unlike a genuine "machine is booked" error.
  const [apiWarning, setApiWarning] = useState<string | null>(null);

  const { checkAvailability, isChecking } = useAvailabilityCheck();

  // Re-check availability whenever the machine type changes (or on mount if
  // a machine was pre-selected via URL params and dates are already set).
  useEffect(() => {
    if (!formData.rentalDate || !onAvailabilityError) return;

    let cancelled = false;

    const run = async () => {
      const result = await checkAvailability(
        formData.machineType,
        formData.capacity,
        formData.rentalDate,
      );

      if (cancelled) return;

      if (!result.available) {
        if (result.error) {
          // API / network failure — warn the user but don't hard-block them.
          // We'll confirm availability manually before accepting the booking.
          setApiWarning(
            "⚠️ We couldn't verify availability right now. You can still continue — we'll confirm your booking by phone.",
          );
          onAvailabilityError(null); // clear any hard block
        } else {
          // Genuine unavailability returned by the API
          setApiWarning(null);
          onAvailabilityError(
            `Sorry, the ${formData.machineType} tank machine is not available on your selected date. Please choose a different machine or go back and pick another date.`,
          );
        }
      } else {
        setApiWarning(null);
        onAvailabilityError(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.machineType, formData.rentalDate]);

  // Helper function to create a properly typed synthetic event
  const createSyntheticEvent = (name: string, value: string | string[]) => {
    return {
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>;
  };

  const handleMachineSelect = (machineType: "single" | "double" | "triple") => {
    const pkg = machinePackages.find((p) => p.type === machineType)!;
    // Update machineType
    onInputChange(createSyntheticEvent("machineType", machineType));
    // Update capacity via separate event
    onInputChange(createSyntheticEvent("capacity", String(pkg.capacity)));
    // Clear selected mixers when machine type changes
    onInputChange(createSyntheticEvent("selectedMixers", []));
    // Advance to mixer substep
    setCurrentSubStep(MachineSubStep.Mixer);
  };

  const handleMixerChange = (mixer: MixerType | null, tankIndex: number) => {
    let newMixers: MixerType[] = [...(formData.selectedMixers || [])];

    if (mixer === null) {
      // Handle "No Mixer" selection
      if (formData.machineType === "single") {
        newMixers = [];
      } else {
        newMixers = newMixers.filter((_, index) => index !== tankIndex);
      }
    } else {
      const isSelected = newMixers[tankIndex] === mixer;

      if (isSelected) {
        // Unselect the mixer
        if (formData.machineType === "single") {
          newMixers = [];
        } else {
          newMixers = newMixers.filter((_, index) => index !== tankIndex);
        }
      } else {
        // Select the mixer
        if (formData.machineType === "single") {
          newMixers = [mixer];
        } else {
          if (tankIndex === 0) {
            newMixers = [mixer, ...newMixers.slice(1)];
          } else if (tankIndex === 1) {
            newMixers = [
              ...newMixers.slice(0, 1),
              mixer,
              ...newMixers.slice(2),
            ];
          } else {
            newMixers = [...newMixers.slice(0, 2), mixer];
          }
        }
      }
    }

    onInputChange(createSyntheticEvent("selectedMixers", newMixers));

    if (currentSubStep === MachineSubStep.Mixer) {
      setCurrentSubStep(MachineSubStep.NextButton);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return format(new Date(dateString), "EEEE, MMMM d, yyyy");
  };

  const getMixerTankSection = (tankIndex: number, tankLabel: string) => (
    <div key={tankLabel}>
      {formData.machineType !== "single" && (
        <h4 className="text-sm font-semibold text-charcoal dark:text-white mb-3">
          {tankLabel}
        </h4>
      )}
      <div className="grid grid-cols-1 gap-2">
        {resolvedMixers.map((mixer) => {
          const idPrefix =
            formData.machineType === "single"
              ? "single"
              : formData.machineType === "double"
                ? `tank${tankIndex + 1}`
                : `tank${tankIndex + 1}-triple`;
          return (
            <MixerCard
              key={`${idPrefix}-${mixer.id}`}
              mixerType={mixer.id as MixerType}
              name={mixer.label}
              price={mixer.price}
              description={mixer.description}
              isSelected={formData.selectedMixers?.[tankIndex] === mixer.id}
              tankIndex={tankIndex}
              checkboxId={`${idPrefix}-${mixer.id}`}
              onChange={handleMixerChange}
            />
          );
        })}
        {/* No Mixer option */}
        <MixerCard
          mixerType={null}
          name="No Mixer"
          price={0}
          description="Bring your own mixer for complete control over your drinks"
          isSelected={
            formData.machineType === "single"
              ? formData.selectedMixers?.length === 0
              : !formData.selectedMixers?.[tankIndex]
          }
          tankIndex={tankIndex}
          checkboxId={
            formData.machineType === "single"
              ? "single-no-mixer"
              : formData.machineType === "double"
                ? `tank${tankIndex + 1}-no-mixer`
                : `tank${tankIndex + 1}-triple-no-mixer`
          }
          onChange={(_, idx) => {
            if (formData.machineType === "single") {
              onInputChange(createSyntheticEvent("selectedMixers", []));
              if (currentSubStep === MachineSubStep.Mixer) {
                setCurrentSubStep(MachineSubStep.NextButton);
              }
            } else {
              handleMixerChange(null, idx);
            }
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          Select Your Machine
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Choose your perfect frozen drink machine setup
        </p>

        {/* Show selected dates as context */}
        {formData.rentalDate && formData.returnDate && (
          <div className="mt-4 p-4 bg-margarita/10 dark:bg-margarita/20 rounded-lg">
            <p className="text-sm text-charcoal/70 dark:text-white/70">
              📅 {formatDate(formData.rentalDate)} →{" "}
              {formatDate(formData.returnDate)}
            </p>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center space-x-2 mt-4">
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= MachineSubStep.MachineType ? "bg-margarita" : "bg-gray-300"}`}
          />
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= MachineSubStep.Mixer ? "bg-margarita" : "bg-gray-300"}`}
          />
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= MachineSubStep.NextButton ? "bg-margarita" : "bg-gray-300"}`}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Machine Selection - Card Grid */}
        <div
          className={`p-4 rounded-xl border-2 transition-all duration-300 ${
            currentSubStep === MachineSubStep.MachineType
              ? "border-margarita animate-pulse bg-margarita/5 shadow-lg shadow-margarita/20"
              : "border-transparent"
          }`}
        >
          <p className="text-sm font-semibold text-charcoal dark:text-white mb-3">
            Machine Type
          </p>
          <div className="grid grid-cols-3 gap-3">
            {machinePackages.map((pkg) => (
              <MachineCard
                key={pkg.type}
                machineType={pkg.type}
                name={pkg.name}
                capacity={pkg.capacity}
                basePrice={pkg.basePrice}
                isSelected={formData.machineType === pkg.type}
                isPopular={machinePopular[pkg.type]}
                onSelect={handleMachineSelect}
                image={machineImages[pkg.type]}
                description={pkg.description}
                guestRange={machineGuestRanges[pkg.type]}
              />
            ))}
          </div>
        </div>

        {/* Mixer Selection */}
        <div
          className={`p-4 rounded-xl border-2 transition-all duration-300 ${
            currentSubStep === MachineSubStep.Mixer
              ? "border-margarita animate-pulse bg-margarita/5 shadow-lg shadow-margarita/20"
              : "border-transparent"
          }`}
        >
          <p className="text-sm font-semibold text-charcoal dark:text-white mb-3">
            {formData.machineType === "single"
              ? "Select 1 Mixer"
              : formData.machineType === "double"
                ? "Select 2 Mixers"
                : "Select 3 Mixers"}
          </p>

          {/* ── Mixer & Alcohol Education Panel ── */}
          <div className="mb-4 space-y-2">
            {/* What's included in each mixer kit */}
            <div className="flex items-start gap-2 bg-teal/10 dark:bg-teal/5 border border-teal/30 dark:border-teal/20 rounded-lg p-3">
              <span className="text-base leading-none mt-0.5 flex-shrink-0">
                🍹
              </span>
              <p className="text-xs text-charcoal/80 dark:text-white/80 leading-relaxed">
                <strong>What&apos;s included:</strong> Each mixer is a ½-gallon
                concentrate. Combined with 2 gallons of water, one kit fills a
                single tank with <strong>~2.5 gallons of finished drink</strong>{" "}
                — ready to freeze and enjoy.
              </p>
            </div>

            {/* TABC compliance + BYOB guidance */}
            <div className="flex items-start gap-2 bg-orange/10 dark:bg-orange/5 border border-orange/30 dark:border-orange/20 rounded-lg p-3">
              <span className="text-base leading-none mt-0.5 flex-shrink-0">
                🚫
              </span>
              <p className="text-xs text-charcoal/80 dark:text-white/80 leading-relaxed">
                <strong>Alcohol policy (Texas TABC):</strong> We are prohibited
                by Texas law from providing or selling alcohol. Many customers
                choose to add their own — each tank can hold up to{" "}
                <strong>one 1.75L bottle (a &quot;handle&quot;)</strong> of
                liquor. Please drink responsibly. 🥃
              </p>
            </div>
          </div>
          {/* ─────────────────────────────────── */}

          {formData.machineType === "single" && (
            <div className="space-y-2">{getMixerTankSection(0, "")}</div>
          )}

          {formData.machineType === "double" && (
            <div className="space-y-6">
              {getMixerTankSection(0, "Tank 1:")}
              {getMixerTankSection(1, "Tank 2:")}
            </div>
          )}

          {formData.machineType === "triple" && (
            <div className="space-y-6">
              {getMixerTankSection(0, "Tank 1:")}
              {getMixerTankSection(1, "Tank 2:")}
              {getMixerTankSection(2, "Tank 3:")}
            </div>
          )}
        </div>

        {isChecking && (
          <div className="flex items-center space-x-2 text-sm text-charcoal/60 dark:text-white/60 px-4 py-3">
            <svg
              className="animate-spin h-4 w-4 text-margarita"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Checking availability for your dates…</span>
          </div>
        )}

        {/* Soft warning when availability API is unreachable — does NOT block Next */}
        {apiWarning && !error && (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-300 px-4 py-3 rounded relative text-sm">
            {apiWarning}
          </div>
        )}

        {/* Hard block error — machine genuinely unavailable */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
