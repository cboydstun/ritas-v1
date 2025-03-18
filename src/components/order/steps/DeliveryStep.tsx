import Image from "next/image";
import { ChangeEvent, useState } from "react";
import { StepProps, inputClassName, labelClassName } from "../types";
import { mixerDetails, MixerType } from "@/lib/rental-data";

// Define the sub-steps for the delivery step
enum DeliverySubStep {
  MachineType = 0,
  Mixer = 1,
  DeliveryDate = 2,
  NextButton = 3,
}

const mixerTypes: MixerType[] = [
  "non-alcoholic",
  "margarita",
  "pina-colada",
  "strawberry-daiquiri",
];

// CSS classes for active step highlighting
const activeStepClass =
  "border-2 border-margarita animate-pulse bg-margarita/10 shadow-lg shadow-margarita/20";
const normalStepClass = "border-2 border-transparent";

export default function DeliveryStep({
  formData,
  onInputChange,
  error,
}: StepProps) {
  // Track the current sub-step
  const [currentSubStep, setCurrentSubStep] = useState<DeliverySubStep>(
    DeliverySubStep.MachineType
  );

  // Helper function to create a properly typed synthetic event
  const createSyntheticEvent = (name: string, value: string | string[]) => {
    return {
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>;
  };

  const handleMixerChange = (mixer: MixerType | null, tankIndex: number) => {
    let newMixers: MixerType[] = [...(formData.selectedMixers || [])];

    if (mixer === null) {
      // Handle "No Mixer" selection
      if (formData.machineType === "single") {
        newMixers = []; // Clear all mixers for single tank
      } else {
        // For double or triple tank, remove the mixer at the specific tank index
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
          newMixers = [mixer]; // Replace any existing mixer
        } else {
          // For double or triple tank, ensure we maintain the correct order
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

    // Progress to the next step if we're on the mixer step
    if (currentSubStep === DeliverySubStep.Mixer) {
      setCurrentSubStep(DeliverySubStep.DeliveryDate);
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          Select Your Machine
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Choose your perfect frozen drink machine setup
        </p>
        <div className="flex justify-center space-x-2 mt-4">
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= DeliverySubStep.MachineType ? "bg-margarita" : "bg-gray-300"}`}
          ></div>
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= DeliverySubStep.Mixer ? "bg-margarita" : "bg-gray-300"}`}
          ></div>
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= DeliverySubStep.DeliveryDate ? "bg-margarita" : "bg-gray-300"}`}
          ></div>
          <div
            className={`w-3 h-3 rounded-full ${currentSubStep >= DeliverySubStep.NextButton ? "bg-margarita" : "bg-gray-300"}`}
          ></div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Machine Type Section */}
        <div
          className={`relative w-full aspect-square mb-4 rounded-lg overflow-hidden transition-all duration-300 ${
            currentSubStep === DeliverySubStep.MachineType
              ? activeStepClass
              : normalStepClass
          }`}
        >
          <Image
            src={
              formData.machineType === "single"
                ? "/vevor-15l-slushy.jpg"
                : formData.machineType === "double"
                  ? "/vevor-30l-slushy.png"
                  : "/vevor-45l-slushy-2.png"
            }
            alt={`${formData.capacity}L ${
              formData.machineType === "single"
                ? "Single"
                : formData.machineType === "double"
                  ? "Double"
                  : "Triple"
            } Tank Machine`}
            fill
            className="object-cover rounded-lg"
            priority
          />
        </div>

        <div
          className={`p-4 rounded-lg transition-all duration-300 ${
            currentSubStep === DeliverySubStep.MachineType
              ? activeStepClass
              : normalStepClass
          }`}
        >
          <label className={labelClassName}>Machine Type</label>
          <select
            name="machineType"
            value={formData.machineType}
            onChange={(e) => {
              onInputChange(e);
              // Move to the next step when machine type is selected
              setCurrentSubStep(DeliverySubStep.Mixer);
            }}
            className={`${inputClassName} focus:border-margarita focus:ring-2 focus:ring-margarita/50`}
          >
            <option value="single">15L Single Tank Machine</option>
            <option value="double">30L Double Tank Machine</option>
            <option value="triple">45L Triple Tank Machine</option>
          </select>
          <p className="mt-2 text-sm text-charcoal/70 dark:text-white/70">
            {formData.machineType === "single"
              ? "Perfect for smaller gatherings and parties"
              : formData.machineType === "double"
                ? "Ideal for larger events and multiple flavors"
                : "The ultimate machine for large events and variety"}
          </p>
        </div>

        {/* Mixer Selection Section */}
        <div
          className={`p-4 rounded-lg mt-6 transition-all duration-300 ${
            currentSubStep === DeliverySubStep.Mixer
              ? activeStepClass
              : normalStepClass
          }`}
        >
          <label className={labelClassName}>
            {formData.machineType === "single"
              ? "Select 1 Mixer"
              : formData.machineType === "double"
                ? "Select 2 Mixers"
                : "Select 3 Mixers"}
          </label>
          <div className="space-y-6 mt-2">
            {formData.machineType === "single" ? (
              // Single Tank Selection
              <div className="space-y-4">
                {mixerTypes.map((type) => (
                  <div key={`single-${type}`} className="flex items-start">
                    <input
                      type="checkbox"
                      id={`single-${type}`}
                      checked={formData.selectedMixers?.[0] === type}
                      onChange={() => handleMixerChange(type, 0)}
                      className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                    />
                    <div className="ml-3">
                      <label
                        htmlFor={`single-${type}`}
                        className="text-sm font-medium text-charcoal dark:text-white"
                      >
                        {mixerDetails[type].label} (+$
                        {mixerDetails[type].price.toFixed(2)})
                      </label>
                      <p className="text-xs text-charcoal/70 dark:text-white/70">
                        {mixerDetails[type].description}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="single-no-mixer"
                    checked={formData.selectedMixers?.length === 0}
                    onChange={() => {
                      onInputChange(createSyntheticEvent("selectedMixers", []));
                      // Progress to the next step
                      if (currentSubStep === DeliverySubStep.Mixer) {
                        setCurrentSubStep(DeliverySubStep.DeliveryDate);
                      }
                    }}
                    className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                  />
                  <div className="ml-3">
                    <label
                      htmlFor="single-no-mixer"
                      className="text-sm font-medium text-charcoal dark:text-white"
                    >
                      No Mixer
                    </label>
                    <p className="text-xs text-charcoal/70 dark:text-white/70">
                      Bring your own mixer for complete control over your drinks
                    </p>
                  </div>
                </div>
              </div>
            ) : formData.machineType === "double" ? (
              // Double Tank Selection
              <div className="space-y-8">
                {/* Tank 1 */}
                <div>
                  <h4 className="text-sm font-medium text-charcoal dark:text-white mb-4">
                    Tank 1:
                  </h4>
                  <div className="space-y-4 pl-4">
                    {mixerTypes.map((type) => (
                      <div key={`tank1-${type}`} className="flex items-start">
                        <input
                          type="checkbox"
                          id={`tank1-${type}`}
                          checked={formData.selectedMixers?.[0] === type}
                          onChange={() => handleMixerChange(type, 0)}
                          className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                        />
                        <div className="ml-3">
                          <label
                            htmlFor={`tank1-${type}`}
                            className="text-sm font-medium text-charcoal dark:text-white"
                          >
                            {mixerDetails[type].label} (+$
                            {mixerDetails[type].price.toFixed(2)})
                          </label>
                          <p className="text-xs text-charcoal/70 dark:text-white/70">
                            {mixerDetails[type].description}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="tank1-no-mixer"
                        checked={!formData.selectedMixers?.[0]}
                        onChange={() => handleMixerChange(null, 0)}
                        className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                      />
                      <div className="ml-3">
                        <label
                          htmlFor="tank1-no-mixer"
                          className="text-sm font-medium text-charcoal dark:text-white"
                        >
                          No Mixer
                        </label>
                        <p className="text-xs text-charcoal/70 dark:text-white/70">
                          Bring your own mixer for complete control over your
                          drinks
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tank 2 */}
                <div>
                  <h4 className="text-sm font-medium text-charcoal dark:text-white mb-4">
                    Tank 2:
                  </h4>
                  <div className="space-y-4 pl-4">
                    {mixerTypes.map((type) => (
                      <div key={`tank2-${type}`} className="flex items-start">
                        <input
                          type="checkbox"
                          id={`tank2-${type}`}
                          checked={formData.selectedMixers?.[1] === type}
                          onChange={() => handleMixerChange(type, 1)}
                          className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                        />
                        <div className="ml-3">
                          <label
                            htmlFor={`tank2-${type}`}
                            className="text-sm font-medium text-charcoal dark:text-white"
                          >
                            {mixerDetails[type].label} (+$
                            {mixerDetails[type].price.toFixed(2)})
                          </label>
                          <p className="text-xs text-charcoal/70 dark:text-white/70">
                            {mixerDetails[type].description}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="tank2-no-mixer"
                        checked={!formData.selectedMixers?.[1]}
                        onChange={() => handleMixerChange(null, 1)}
                        className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                      />
                      <div className="ml-3">
                        <label
                          htmlFor="tank2-no-mixer"
                          className="text-sm font-medium text-charcoal dark:text-white"
                        >
                          No Mixer
                        </label>
                        <p className="text-xs text-charcoal/70 dark:text-white/70">
                          Bring your own mixer for complete control over your
                          drinks
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Triple Tank Selection
              <div className="space-y-8">
                {/* Tank 1 */}
                <div>
                  <h4 className="text-sm font-medium text-charcoal dark:text-white mb-4">
                    Tank 1:
                  </h4>
                  <div className="space-y-4 pl-4">
                    {mixerTypes.map((type) => (
                      <div
                        key={`tank1-triple-${type}`}
                        className="flex items-start"
                      >
                        <input
                          type="checkbox"
                          id={`tank1-triple-${type}`}
                          checked={formData.selectedMixers?.[0] === type}
                          onChange={() => handleMixerChange(type, 0)}
                          className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                        />
                        <div className="ml-3">
                          <label
                            htmlFor={`tank1-triple-${type}`}
                            className="text-sm font-medium text-charcoal dark:text-white"
                          >
                            {mixerDetails[type].label} (+$
                            {mixerDetails[type].price.toFixed(2)})
                          </label>
                          <p className="text-xs text-charcoal/70 dark:text-white/70">
                            {mixerDetails[type].description}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="tank1-triple-no-mixer"
                        checked={!formData.selectedMixers?.[0]}
                        onChange={() => handleMixerChange(null, 0)}
                        className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                      />
                      <div className="ml-3">
                        <label
                          htmlFor="tank1-triple-no-mixer"
                          className="text-sm font-medium text-charcoal dark:text-white"
                        >
                          No Mixer
                        </label>
                        <p className="text-xs text-charcoal/70 dark:text-white/70">
                          Bring your own mixer for complete control over your
                          drinks
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tank 2 */}
                <div>
                  <h4 className="text-sm font-medium text-charcoal dark:text-white mb-4">
                    Tank 2:
                  </h4>
                  <div className="space-y-4 pl-4">
                    {mixerTypes.map((type) => (
                      <div
                        key={`tank2-triple-${type}`}
                        className="flex items-start"
                      >
                        <input
                          type="checkbox"
                          id={`tank2-triple-${type}`}
                          checked={formData.selectedMixers?.[1] === type}
                          onChange={() => handleMixerChange(type, 1)}
                          className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                        />
                        <div className="ml-3">
                          <label
                            htmlFor={`tank2-triple-${type}`}
                            className="text-sm font-medium text-charcoal dark:text-white"
                          >
                            {mixerDetails[type].label} (+$
                            {mixerDetails[type].price.toFixed(2)})
                          </label>
                          <p className="text-xs text-charcoal/70 dark:text-white/70">
                            {mixerDetails[type].description}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="tank2-triple-no-mixer"
                        checked={!formData.selectedMixers?.[1]}
                        onChange={() => handleMixerChange(null, 1)}
                        className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                      />
                      <div className="ml-3">
                        <label
                          htmlFor="tank2-triple-no-mixer"
                          className="text-sm font-medium text-charcoal dark:text-white"
                        >
                          No Mixer
                        </label>
                        <p className="text-xs text-charcoal/70 dark:text-white/70">
                          Bring your own mixer for complete control over your
                          drinks
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tank 3 */}
                <div>
                  <h4 className="text-sm font-medium text-charcoal dark:text-white mb-4">
                    Tank 3:
                  </h4>
                  <div className="space-y-4 pl-4">
                    {mixerTypes.map((type) => (
                      <div
                        key={`tank3-triple-${type}`}
                        className="flex items-start"
                      >
                        <input
                          type="checkbox"
                          id={`tank3-triple-${type}`}
                          checked={formData.selectedMixers?.[2] === type}
                          onChange={() => handleMixerChange(type, 2)}
                          className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                        />
                        <div className="ml-3">
                          <label
                            htmlFor={`tank3-triple-${type}`}
                            className="text-sm font-medium text-charcoal dark:text-white"
                          >
                            {mixerDetails[type].label} (+$
                            {mixerDetails[type].price.toFixed(2)})
                          </label>
                          <p className="text-xs text-charcoal/70 dark:text-white/70">
                            {mixerDetails[type].description}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="tank3-triple-no-mixer"
                        checked={!formData.selectedMixers?.[2]}
                        onChange={() => handleMixerChange(null, 2)}
                        className="h-4 w-4 text-margarita border-gray-300 rounded focus:ring-margarita"
                      />
                      <div className="ml-3">
                        <label
                          htmlFor="tank3-triple-no-mixer"
                          className="text-sm font-medium text-charcoal dark:text-white"
                        >
                          No Mixer
                        </label>
                        <p className="text-xs text-charcoal/70 dark:text-white/70">
                          Bring your own mixer for complete control over your
                          drinks
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Date Section */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg mt-6 transition-all duration-300 ${
            currentSubStep === DeliverySubStep.DeliveryDate
              ? activeStepClass
              : normalStepClass
          }`}
        >
          <div>
            <label className={labelClassName}>Delivery Date</label>
            <input
              type="date"
              name="rentalDate"
              value={formData.rentalDate}
              onChange={(e) => {
                onInputChange(e);
                // Move to the next step when delivery date is selected
                setCurrentSubStep(DeliverySubStep.NextButton);
              }}
              className={`${inputClassName} focus:border-margarita focus:ring-2 focus:ring-margarita/50`}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div>
            <label className={labelClassName}>Delivery Time</label>
            <input
              type="time"
              name="rentalTime"
              value={formData.rentalTime}
              onChange={onInputChange}
              className={inputClassName}
              min="08:00"
              max="18:00"
              step="3600"
            />
          </div>

          <div>
            <label className={labelClassName}>Pick Up Date</label>
            <input
              type="date"
              name="returnDate"
              value={formData.returnDate}
              onChange={onInputChange}
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Pick Up Time</label>
            <input
              type="time"
              name="returnTime"
              value={formData.returnTime}
              onChange={onInputChange}
              className={inputClassName}
              min="08:00"
              max="18:00"
              step="3600"
            />
          </div>
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
