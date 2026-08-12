import { ChangeEvent, useState, useEffect } from "react";
import { StepProps } from "../types";
import { mixerDetails, machinePackages, MixerType } from "@/lib/rental-data";
import { format, parseISO } from "date-fns";
import MachineCard from "./MachineCard";
import MixerCard from "./MixerCard";
import { useAvailabilityCheck } from "@/hooks/useAvailabilityCheck";
import type { MachineType } from "@/types";

/** "idle" = no date range yet, so there is nothing to check. */
type AvailabilityState =
  "idle" | "loading" | "available" | "unavailable" | "error";

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
  onAvailabilityChecking,
  mixers: mixersProp,
  settings,
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

  // Per-machine-type availability so each card can be disabled independently
  // before the customer commits to a choice.
  const [availabilityByType, setAvailabilityByType] = useState<
    Record<MachineType, AvailabilityState>
  >({ single: "idle", double: "idle", triple: "idle" });

  const { checkAvailability } = useAvailabilityCheck();

  // Told to the parent so "Next" cannot advance on a machine whose
  // availability has not come back yet. The hook's own `isChecking` flag is
  // useless here: three calls share it, so the first response cleared it while
  // the other two were still outstanding.
  const isChecking = Object.values(availabilityByType).includes("loading");

  // Announced when the auto-fallback swaps the customer's machine out from
  // under them — it also changes capacity, clears the tank mixers and moves
  // the price, all of which used to happen silently.
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  // Check all three machine types in parallel so the cards reflect inventory
  // up front. This depends on the date range only — deriving the hard-block
  // error used to put `machineType` in the dep array too, so every auto-switch
  // and every manual card click fired three more availability requests.
  useEffect(() => {
    if (!formData.rentalDate) {
      // Nothing to check yet. Leaving the cards on "loading" would make every
      // one of them unselectable with no request ever coming to clear it.
      setAvailabilityByType({
        single: "idle",
        double: "idle",
        triple: "idle",
      });
      return;
    }
    const types: MachineType[] = ["single", "double", "triple"];

    setAvailabilityByType({
      single: "loading",
      double: "loading",
      triple: "loading",
    });

    let cancelled = false;

    Promise.all(
      types.map((t) => {
        const pkg = machinePackages.find((p) => p.type === t)!;
        return checkAvailability(
          t,
          pkg.capacity,
          formData.rentalDate,
          formData.returnDate,
        ).then((res) => ({ t, res }));
      }),
    ).then((entries) => {
      if (cancelled) return;

      const next: Record<MachineType, AvailabilityState> = {
        single: "available",
        double: "available",
        triple: "available",
      };
      let anyApiError = false;
      for (const { t, res } of entries) {
        if (res.error) {
          next[t] = "error";
          anyApiError = true;
        } else {
          next[t] = res.available ? "available" : "unavailable";
        }
      }
      setAvailabilityByType(next);

      setApiWarning(
        anyApiError
          ? "⚠️ We couldn't verify availability right now. You can still continue — we'll confirm your booking by phone."
          : null,
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.rentalDate, formData.returnDate]);

  // Derive the selection consequences from whatever the checks returned. Kept
  // separate from the fetch above so a machine switch re-derives without
  // re-requesting.
  useEffect(() => {
    const selected = formData.machineType as MachineType;
    const state = selected ? availabilityByType[selected] : "idle";
    if (!selected || state === "loading" || state === "idle") return;

    if (state !== "unavailable") {
      setFallbackNotice(null);
      if (onAvailabilityError) onAvailabilityError(null);
      return;
    }

    // Auto-fallback: if the currently selected machine is unavailable but
    // another type is available, switch to it (priority: triple > double > single).
    const fallbackOrder: MachineType[] = ["triple", "double", "single"];
    const fallback = fallbackOrder.find(
      (t) => t !== selected && availabilityByType[t] === "available",
    );
    if (fallback) {
      const pkg = machinePackages.find((p) => p.type === fallback)!;
      onInputChange(createSyntheticEvent("machineType", fallback));
      onInputChange(createSyntheticEvent("capacity", String(pkg.capacity)));
      onInputChange(createSyntheticEvent("selectedMixers", []));
      setFallbackNotice(
        `Our ${selected} tank machines are booked for your dates, so we switched you to the ${fallback} tank — ${pkg.capacity} litres at $${pkg.basePrice}/day. Your mixer choices were cleared; pick them again below.`,
      );
      if (onAvailabilityError) onAvailabilityError(null);
      return;
    }

    setFallbackNotice(null);
    if (onAvailabilityError) {
      onAvailabilityError(
        `Sorry, our ${selected} tank machines are fully booked for one or more days in your selected range. Please choose a different machine or go back and pick another date.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityByType, formData.machineType]);

  // Keep the parent in step with the in-flight checks so "Next" cannot skip
  // ahead onto a machine the server is about to refuse.
  useEffect(() => {
    onAvailabilityChecking?.(isChecking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChecking]);

  // Helper function to create a properly typed synthetic event
  const createSyntheticEvent = (name: string, value: string | string[]) => {
    return {
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>;
  };

  const handleMachineSelect = (machineType: "single" | "double" | "triple") => {
    // "loading" used to count as selectable, so every card was clickable —
    // and "Next" reachable — before any check had come back.
    const state = availabilityByType[machineType];
    if (state === "loading" || state === "unavailable") return;
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
    // parseISO, not new Date(): `new Date("2026-08-15")` parses as UTC
    // midnight, which in Central is the 14th — the header showed the day
    // before the one the customer picked. Same fix as DateSelectionStep.
    return format(parseISO(dateString), "EEEE, MMMM d, yyyy");
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
                basePrice={
                  settings?.machines?.[pkg.type]?.basePrice ?? pkg.basePrice
                }
                isSelected={formData.machineType === pkg.type}
                isAvailable={
                  availabilityByType[pkg.type] !== "loading" &&
                  availabilityByType[pkg.type] !== "unavailable"
                }
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
          <div
            role="status"
            aria-live="polite"
            className="flex items-center space-x-2 text-sm text-charcoal/60 dark:text-white/60 px-4 py-3"
          >
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

        {/* The auto-fallback rewrites machine, capacity, mixers and price. It
            used to do all of that with no visible explanation. */}
        {fallbackNotice && (
          <div
            role="status"
            aria-live="polite"
            className="bg-blue-50 border border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300 px-4 py-3 rounded relative text-sm"
          >
            {fallbackNotice}
          </div>
        )}

        {/* Soft warning when availability API is unreachable — does NOT block Next */}
        {apiWarning && !error && (
          <div
            role="status"
            aria-live="polite"
            className="bg-yellow-50 border border-yellow-300 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-300 px-4 py-3 rounded relative text-sm"
          >
            {apiWarning}
          </div>
        )}

        {/* Hard block error — machine genuinely unavailable */}
        {error && (
          <div
            role="alert"
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
