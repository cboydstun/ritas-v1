import { ChangeEvent, useState } from "react";
import { StepProps } from "../types";
import { mixerDetails, machinePackages, MixerType } from "@/lib/rental-data";
import { format } from "date-fns";
import MachineCard from "./MachineCard";
import MixerCard from "./MixerCard";

// Define the sub-steps for the machine step
enum MachineSubStep {
  MachineType = 0,
  Mixer = 1,
  NextButton = 2,
}

const mixerTypes: MixerType[] = [
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
}: StepProps) {
  // Track the current sub-step
  const [currentSubStep, setCurrentSubStep] = useState<MachineSubStep>(
    MachineSubStep.MachineType,
  );

  // Helper function to create a properly typed synthetic event
  const createSyntheticEvent = (name: string, value: string | string[]) => {
    return {
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>;
  };

  const handleMachineSelect = (
    machineType: "single" | "double" | "triple",
  ) => {
    const pkg = machinePackages.find((p) => p.type === machineType)!;
    // Update machineType
    onInputChange(createSyntheticEvent("machineType", machineType));
    // Update capacity via separate event
    onInputChange(
      createSyntheticEvent("capacity", String(pkg.capacity)),
    );
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
            newMixers = [...newMixers.slice(0, 1), mixer, ...newMixers.slice(2)];
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
        {mixerTypes.map((type) => {
          const idPrefix =
            formData.machineType === "single"
              ? "single"
              : formData.machineType === "double"
                ? `tank${tankIndex + 1}`
                : `tank${tankIndex + 1}-triple`;
          return (
            <MixerCard
              key={`${idPrefix}-${type}`}
              mixerType={type}
              name={mixerDetails[type].label}
              price={mixerDetails[type].price}
              description={mixerDetails[type].description}
              isSelected={formData.selectedMixers?.[tankIndex] === type}
              tankIndex={tankIndex}
              checkboxId={`${idPrefix}-${type}`}
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

          {formData.machineType === "single" && (
            <div className="space-y-2">
              {getMixerTankSection(0, "")}
            </div>
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
