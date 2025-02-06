import Image from "next/image";
import { StepProps } from "../types";
import { mixerDetails, MixerType } from "@/lib/rental-data";
import { calculatePricing } from "../utils";

export default function ReviewStep({
  formData,
  agreedToTerms = false,
  setAgreedToTerms = () => {},
}: StepProps) {
  const {
    rentalDays,
    perDayRate,
    deliveryFee,
    subtotal,
    salesTax,
    processingFee,
    total,
  } = calculatePricing(
    formData.price,
    formData.rentalDate,
    formData.returnDate,
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Review Your Order
      </h2>
      <div className="space-y-4">
        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <div className="relative w-full aspect-square mb-4">
            <Image
              src={
                formData.machineType === "single"
                  ? "/vevor-15l-slushy-2.jpg"
                  : "/vevor-30l-slushy-2.png"
              }
              alt={`${formData.capacity}L ${formData.machineType === "single" ? "Single" : "Double"} Tank Machine`}
              fill
              className="object-cover rounded-lg"
              priority
            />
          </div>
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Selected Machine
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.capacity}L{" "}
            {formData.machineType === "single" ? "Single" : "Double"} Tank
            Machine
          </p>
          <div className="text-charcoal/70 dark:text-white/70">
            <p className="mb-2">Selected Mixers:</p>
            {formData.selectedMixers.length === 0 ? (
              <p>No mixers selected - Bring your own mixer</p>
            ) : formData.machineType === "single" ? (
              // Single Tank Display
              <ul className="list-disc list-inside">
                {formData.selectedMixers[0] && (
                  <li>
                    {
                      mixerDetails[formData.selectedMixers[0] as MixerType]
                        .label
                    }
                  </li>
                )}
              </ul>
            ) : (
              // Double Tank Display
              <div className="space-y-2">
                <div>
                  <p className="font-medium">Tank 1:</p>
                  {formData.selectedMixers[0] ? (
                    <p className="ml-4">
                      {
                        mixerDetails[formData.selectedMixers[0] as MixerType]
                          .label
                      }
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 2:</p>
                  {formData.selectedMixers[1] ? (
                    <p className="ml-4">
                      {
                        mixerDetails[formData.selectedMixers[1] as MixerType]
                          .label
                      }
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="text-xl font-bold text-orange mt-2">
            ${perDayRate}/day
          </p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Rental Details
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            Delivery:{" "}
            {new Date(formData.rentalDate + "T12:00:00").toLocaleDateString()}{" "}
            at {formData.rentalTime}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Pick Up:{" "}
            {new Date(formData.returnDate + "T12:00:00").toLocaleDateString()}{" "}
            at {formData.returnTime}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Contact Information
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.name}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.email}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.phone}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.address.street},
            <br />
            {formData.customer.address.city}, {formData.customer.address.state}{" "}
            {formData.customer.address.zipCode}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Pricing Details
          </h3>
          <p className=" text-charcoal/70 dark:text-white/70">
            Rate: ${perDayRate}/day × {rentalDays} day
            {rentalDays > 1 ? "s" : ""}
          </p>
          <p className=" text-charcoal/70 dark:text-white/70">
            Delivery Fee: ${deliveryFee.toFixed(2)}
          </p>
          <p className=" text-charcoal/70 dark:text-white/70">
            Subtotal: ${subtotal.toFixed(2)}
          </p>
          <p className=" text-charcoal/70 dark:text-white/70">
            Sales Tax (8.25%): ${salesTax.toFixed(2)}
          </p>
          <p className=" text-charcoal/70 dark:text-white/70">
            Processing Fee (3%): ${processingFee.toFixed(2)}
          </p>
          <p className="text-xl font-bold text-orange mb-4">
            Total Amount: ${total.toFixed(2)}
          </p>
          <div className="flex items-center space-x-2 mt-4">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 text-orange rounded focus:ring-orange"
            />
            <label
              htmlFor="agreeTerms"
              className="text-charcoal/70 dark:text-white/70"
            >
              I confirm all the information above is correct and agree to
              communications.
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
