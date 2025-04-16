import Image from "next/image";
import { StepProps, extraItems, ExtraItem } from "../types";
import { useState } from "react";
import { PlusIcon, MinusIcon } from "@heroicons/react/24/solid";

export default function ExtrasStep({
  formData,
  onInputChange,
  error,
}: StepProps) {
  // Local state to track selected extras
  const [selectedExtras, setSelectedExtras] = useState<ExtraItem[]>(
    formData.selectedExtras || [],
  );

  // Calculate the total price for an item based on quantity
  const calculateItemTotal = (item: ExtraItem): number => {
    return item.price * (item.quantity || 1);
  };

  // Handle checkbox change
  const handleExtraChange = (extra: ExtraItem, isChecked: boolean) => {
    let newSelectedExtras: ExtraItem[];

    if (isChecked) {
      // Add the extra if it's checked
      newSelectedExtras = [...selectedExtras, extra];
    } else {
      // Remove the extra if it's unchecked
      newSelectedExtras = selectedExtras.filter((item) => item.id !== extra.id);
    }

    setSelectedExtras(newSelectedExtras);
    updateFormData(newSelectedExtras);
  };

  // Handle quantity change
  const handleQuantityChange = (extraId: string, newQuantity: number) => {
    if (newQuantity < 1) return; // Don't allow quantities less than 1

    const newSelectedExtras = selectedExtras.map((item) =>
      item.id === extraId ? { ...item, quantity: newQuantity } : item,
    );

    setSelectedExtras(newSelectedExtras);
    updateFormData(newSelectedExtras);
  };

  // Update form data with new extras and recalculate price
  const updateFormData = (newSelectedExtras: ExtraItem[]) => {
    // Create a synthetic event to maintain compatibility with the existing onInputChange
    const syntheticEvent = {
      target: {
        name: "selectedExtras",
        value: newSelectedExtras,
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onInputChange(syntheticEvent);

    // Update the total price
    const extrasTotal = newSelectedExtras.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0,
    );
    const newPrice = formData.price + extrasTotal;

    // Create a synthetic event for price update
    const priceEvent = {
      target: {
        name: "price",
        value: newPrice,
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onInputChange(priceEvent);
  };

  // Check if an extra is selected
  const isExtraSelected = (extraId: string) => {
    return selectedExtras.some((extra) => extra.id === extraId);
  };

  // Get the quantity of a selected extra
  const getExtraQuantity = (extraId: string): number => {
    const extra = selectedExtras.find((item) => item.id === extraId);
    return extra?.quantity || 1;
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          Enhance Your Party
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Add optional extras to make your event even more special
        </p>
        <p className="text-charcoal/70 dark:text-white/70 text-sm mt-2">
          Note: All extras are charged per day, just like the machine rental
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {extraItems.map((extra) => (
          <div
            key={extra.id}
            className={`bg-white/80 dark:bg-charcoal/30 rounded-xl p-4 transition-all ${
              isExtraSelected(extra.id)
                ? "border-2 border-margarita"
                : "border border-transparent hover:border-margarita/50"
            }`}
          >
            {/* Mobile-optimized layout with flex-col on small screens and flex-row on larger screens */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4">
              {/* Image container - centered on mobile, left-aligned on larger screens */}
              <div
                className="flex-shrink-0 w-full sm:w-24 h-20 sm:h-24 relative rounded-lg overflow-hidden mb-3 sm:mb-0 mx-auto sm:mx-0"
                style={{ maxWidth: "120px" }}
              >
                <Image
                  src={extra.image}
                  alt={extra.name}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Content container */}
              <div className="flex-grow">
                {/* Title and price - stack on mobile, side-by-side on larger screens */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 sm:mb-0">
                  <h3 className="font-semibold text-lg text-charcoal dark:text-white text-center sm:text-left mb-1 sm:mb-0">
                    {extra.name}
                  </h3>
                  <span className="text-lg font-bold text-orange text-center sm:text-right mb-2 sm:mb-0">
                    ${extra.price.toFixed(2)}/day
                  </span>
                </div>

                {/* Description */}
                <p className="text-charcoal/70 dark:text-white/70 text-sm mb-3 text-center sm:text-left">
                  {extra.description}
                </p>

                {/* Add to order checkbox - centered on mobile */}
                <div className="flex items-center justify-center sm:justify-start mt-2">
                  <input
                    type="checkbox"
                    id={`extra-${extra.id}`}
                    checked={isExtraSelected(extra.id)}
                    onChange={(e) => handleExtraChange(extra, e.target.checked)}
                    className="h-5 w-5 text-margarita border-gray-300 rounded focus:ring-margarita"
                  />
                  <label
                    htmlFor={`extra-${extra.id}`}
                    className="ml-2 text-charcoal dark:text-white cursor-pointer"
                  >
                    Add to my order
                  </label>
                </div>

                {/* Quantity controls - centered on mobile, improved touch targets */}
                {extra.allowQuantity && isExtraSelected(extra.id) && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start mt-4 gap-2">
                    <span className="text-sm text-charcoal/70 dark:text-white/70 w-full sm:w-auto text-center sm:text-left">
                      Quantity:
                    </span>
                    <div className="flex items-center border border-gray-300 rounded">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(
                            extra.id,
                            getExtraQuantity(extra.id) - 1,
                          )
                        }
                        className="px-3 py-2 text-gray-500 hover:text-margarita focus:outline-none"
                        disabled={getExtraQuantity(extra.id) <= 1}
                        aria-label="Decrease quantity"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="px-3 py-1 text-charcoal dark:text-white min-w-[40px] text-center">
                        {getExtraQuantity(extra.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(
                            extra.id,
                            getExtraQuantity(extra.id) + 1,
                          )
                        }
                        className="px-3 py-2 text-gray-500 hover:text-margarita focus:outline-none"
                        aria-label="Increase quantity"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {getExtraQuantity(extra.id) > 1 && (
                      <span className="text-sm text-orange font-medium ml-2">
                        ${(extra.price * getExtraQuantity(extra.id)).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
    </div>
  );
}
