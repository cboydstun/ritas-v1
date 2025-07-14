import Image from "next/image";
import { StepProps } from "../types";
import { mixerDetails, MixerType } from "@/lib/rental-data";
import { calculatePrice, formatPrice } from "@/lib/pricing";

export default function ReviewStep({
  formData,
  agreedToTerms = false,
  setAgreedToTerms = () => {},
  isServiceDiscount = false,
  setIsServiceDiscount = () => {},
}: StepProps) {
  // Use isServiceDiscount from props for the checkbox state, but update formData when it changes
  const applyServiceDiscount =
    formData.isServiceDiscount !== undefined
      ? formData.isServiceDiscount
      : isServiceDiscount;
  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers[0] as MixerType,
  );

  const perDayRate = priceBreakdown.basePrice + priceBreakdown.mixerPrice;

  const rentalDays = Math.max(
    1,
    Math.ceil(
      (new Date(formData.returnDate).getTime() -
        new Date(formData.rentalDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  // Calculate extras total (per day × number of days)
  const extrasTotal = formData.selectedExtras.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1) * rentalDays,
    0,
  );

  // Recalculate subtotal including extras
  const subtotal =
    perDayRate * rentalDays + priceBreakdown.deliveryFee + extrasTotal;

  // Calculate service discount if applicable
  const serviceDiscountAmount = applyServiceDiscount ? subtotal * 0.1 : 0;

  // Apply discount to subtotal
  const discountedSubtotal = subtotal - serviceDiscountAmount;

  // Recalculate tax and processing fee based on the discounted subtotal
  const salesTax = discountedSubtotal * 0.0825; // 8.25% tax rate
  const processingFee = discountedSubtotal * 0.03; // 3% processing fee

  // Calculate the final total including extras and discount
  const finalTotal = discountedSubtotal + salesTax + processingFee;

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
                  : formData.machineType === "double"
                    ? "/vevor-30l-slushy-2.png"
                    : "/vevor-45l-slushy-1.webp" // Use double tank image for triple until we have a proper image
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
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Selected Machine
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.capacity}L{" "}
            {formData.machineType === "single"
              ? "Single"
              : formData.machineType === "double"
                ? "Double"
                : "Triple"}{" "}
            Tank Machine
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
            ) : formData.machineType === "double" ? (
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
            ) : (
              // Triple Tank Display
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
                <div>
                  <p className="font-medium">Tank 3:</p>
                  {formData.selectedMixers[2] ? (
                    <p className="ml-4">
                      {
                        mixerDetails[formData.selectedMixers[2] as MixerType]
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
            ${formatPrice(perDayRate)}/day
          </p>
        </div>

        {formData.selectedExtras.length > 0 && (
          <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl mt-4">
            <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
              Selected Extras
            </h3>
            <div className="space-y-2">
              {formData.selectedExtras.map((extra) => (
                <div key={extra.id} className="flex justify-between">
                  <p className="text-charcoal/70 dark:text-white/70">
                    {extra.name}{" "}
                    {extra.quantity && extra.quantity > 1
                      ? `(${extra.quantity}x)`
                      : ""}
                  </p>
                  <p className="text-charcoal/70 dark:text-white/70">
                    ${formatPrice(extra.price * (extra.quantity || 1))}/day ×{" "}
                    {rentalDays} day{rentalDays > 1 ? "s" : ""} = $
                    {formatPrice(
                      extra.price * (extra.quantity || 1) * rentalDays,
                    )}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-lg font-semibold text-orange mt-4">
              Extras Total: $
              {formatPrice(
                formData.selectedExtras.reduce(
                  (sum, item) =>
                    sum + item.price * (item.quantity || 1) * rentalDays,
                  0,
                ),
              )}
            </p>
          </div>
        )}

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
            Rate: ${formatPrice(perDayRate)}/day × {rentalDays} day
            {rentalDays > 1 ? "s" : ""}
          </p>
          {formData.selectedExtras.length > 0 && (
            <p className=" text-charcoal/70 dark:text-white/70">
              Extras: $
              {formatPrice(
                formData.selectedExtras.reduce(
                  (sum, item) =>
                    sum + item.price * (item.quantity || 1) * rentalDays,
                  0,
                ),
              )}{" "}
              ($
              {formatPrice(
                formData.selectedExtras.reduce(
                  (sum, item) => sum + item.price * (item.quantity || 1),
                  0,
                ),
              )}
              /day × {rentalDays} day{rentalDays > 1 ? "s" : ""})
            </p>
          )}
          <p className=" text-charcoal/70 dark:text-white/70">
            Delivery Fee: ${formatPrice(priceBreakdown.deliveryFee)}
          </p>
          <p className=" text-charcoal/70 dark:text-white/70">
            Subtotal: $
            {formatPrice(
              perDayRate * rentalDays +
                priceBreakdown.deliveryFee +
                formData.selectedExtras.reduce(
                  (sum, item) =>
                    sum + item.price * (item.quantity || 1) * rentalDays,
                  0,
                ),
            )}
          </p>
          {applyServiceDiscount && (
            <p className=" text-charcoal/70 dark:text-white/70">
              Service Discount (10%): -${formatPrice(serviceDiscountAmount)}
            </p>
          )}
          <p className=" text-charcoal/70 dark:text-white/70">
            Sales Tax (8.25%): ${formatPrice(salesTax)}
          </p>
          <p className=" text-charcoal/70 dark:text-white/70">
            Processing Fee (3%): ${formatPrice(processingFee)}
          </p>
          <p className="text-xl font-bold text-orange mb-4">
            Total Amount: ${formatPrice(finalTotal)}
          </p>
          <div className="flex items-center space-x-2 mt-4 mb-4">
            <input
              type="checkbox"
              id="serviceDiscount"
              checked={applyServiceDiscount}
              onChange={(e) => {
                // Update both the local state and the formData
                setIsServiceDiscount(e.target.checked);
              }}
              className="w-4 h-4 text-orange rounded focus:ring-orange"
            />
            <label
              htmlFor="serviceDiscount"
              className="text-charcoal/70 dark:text-white/70"
            >
              I am a military member, educator, police officer, firefighter, or
              medical professional — apply 10% discount.
            </label>
          </div>

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
