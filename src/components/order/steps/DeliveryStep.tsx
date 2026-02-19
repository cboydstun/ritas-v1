import Image from "next/image";
import { ChangeEvent, useState, useEffect } from "react";
import { formatDateForDisplay } from "../utils";
import { StepProps, inputClassName, labelClassName } from "../types";
import { mixerDetails, MixerType } from "@/lib/rental-data";
import { useAvailabilityCheck } from "@/hooks/useAvailabilityCheck";

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
  onAvailabilityError,
}: StepProps) {
  // Track the current sub-step
  const [currentSubStep, setCurrentSubStep] = useState<DeliverySubStep>(
    DeliverySubStep.MachineType,
  );

  // State for availability checking
  const [dateAvailabilityError, setDateAvailabilityError] = useState<
    string | null
  >(null);
  const { checkAvailability, isChecking } = useAvailabilityCheck();

  // Update parent component when availability error changes
  useEffect(() => {
    if (onAvailabilityError) {
      onAvailabilityError(dateAvailabilityError);
    }
  }, [dateAvailabilityError, onAvailabilityError]);

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
              onChange={async (e) => {
                const { name, value } = e.target;
                onInputChange(e);

                // Only check availability when rental date changes and has a value
                if (name === "rentalDate" && value) {
                  setDateAvailabilityError(null);

                  // Get capacity based on machine type
                  const capacity =
                    formData.machineType === "single"
                      ? 15
                      : formData.machineType === "double"
                        ? 30
                        : 45;

                  const result = await checkAvailability(
                    formData.machineType,
                    capacity,
                    value,
                  );

                  if (!result.available) {
                    const formattedDate = formatDateForDisplay(value);
                    setDateAvailabilityError(
                      `Sorry, the ${capacity}L ${formData.machineType} tank machine is not available on ${formattedDate}. Please select a different date or machine type.`,
                    );
                  } else {
                    // Only advance to next step if machine is available
                    setCurrentSubStep(DeliverySubStep.NextButton);
                  }
                }
              }}
              className={`${inputClassName} ${dateAvailabilityError ? "border-red-500" : ""} focus:border-margarita focus:ring-2 focus:ring-margarita/50`}
              min={new Date().toISOString().split("T")[0]}
            />

            {isChecking && (
              <div className="flex items-center mt-2">
                <svg
                  className="animate-spin h-4 w-4 text-orange mr-2"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm text-orange">
                  Checking availability...
                </span>
              </div>
            )}

            {!isChecking && formData.rentalDate && !dateAvailabilityError && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <div className="flex items-start space-x-2">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Great choice! This machine is available
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      {formData.machineType === "single" &&
                        "Perfect for parties of 20-30 guests. Book now to secure your date!"}
                      {formData.machineType === "double" &&
                        "Ideal for 40-60 guests. Limited availability - reserve today!"}
                      {formData.machineType === "triple" &&
                        "Our largest machine for 70+ guests. High demand - book fast!"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {dateAvailabilityError && (
              <p className="text-sm text-red-500 mt-1">
                {dateAvailabilityError}
              </p>
            )}
          </div>

          <div>
            <label className={labelClassName}>Delivery Time</label>
            <select
              name="rentalTime"
              value={formData.rentalTime}
              onChange={onInputChange}
              className={inputClassName}
            >
              <option value="ANY">ANY TIME</option>
              <option value="08:00">8:00 AM</option>
              <option value="09:00">9:00 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="13:00">1:00 PM</option>
              <option value="14:00">2:00 PM</option>
              <option value="15:00">3:00 PM</option>
              <option value="16:00">4:00 PM</option>
              <option value="17:00">5:00 PM</option>
              <option value="18:00">6:00 PM</option>
            </select>
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
            <select
              name="returnTime"
              value={formData.returnTime}
              onChange={onInputChange}
              className={inputClassName}
            >
              <option value="ANY">ANY TIME</option>
              <option value="08:00">8:00 AM</option>
              <option value="09:00">9:00 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="13:00">1:00 PM</option>
              <option value="14:00">2:00 PM</option>
              <option value="15:00">3:00 PM</option>
              <option value="16:00">4:00 PM</option>
              <option value="17:00">5:00 PM</option>
              <option value="18:00">6:00 PM</option>
            </select>
          </div>
        </div>

        {(error || dateAvailabilityError) && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error || dateAvailabilityError}
          </div>
        )}
      </div>
    </div>
  );
}
