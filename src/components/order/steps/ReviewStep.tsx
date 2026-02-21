import { useState } from "react";
import Image from "next/image";
import { StepProps } from "../types";
import { mixerDetails, MixerType } from "@/lib/rental-data";
import { formatPrice } from "@/lib/pricing";
import { computeOrderTotal } from "../utils";

export default function ReviewStep({
  formData,
  agreedToTerms = false,
  setAgreedToTerms = () => {},
  setIsServiceDiscount = () => {},
  onSuccess,
}: StepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    deliveryFee,
    perDayRate,
    rentalDays,
    extrasTotal,
    serviceDiscountAmount,
    salesTax,
    processingFee,
    finalTotal,
  } = computeOrderTotal(formData);

  // Read from formData — single source of truth
  const applyServiceDiscount = formData.isServiceDiscount;

  const handleConfirmBooking = async () => {
    if (!agreedToTerms) {
      setSubmitError("Please agree to the terms and conditions");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/save-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rentalData: {
            machineType: formData.machineType,
            capacity: formData.capacity,
            selectedMixers: formData.selectedMixers,
            selectedExtras: formData.selectedExtras,
            price: finalTotal,
            rentalDate: formData.rentalDate,
            rentalTime: formData.rentalTime,
            returnDate: formData.returnDate,
            returnTime: formData.returnTime,
            customer: formData.customer,
            notes: formData.notes,
            isServiceDiscount: applyServiceDiscount,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save booking");
      }

      const result = await response.json();

      // Build URL parameters for the success page
      const params = new URLSearchParams();
      params.append("bookingId", result.bookingId);
      params.append("machineType", formData.machineType);
      params.append("customerName", formData.customer.name);
      params.append("rentalDate", formData.rentalDate);
      params.append("total", finalTotal.toFixed(2));

      // Add mixers to URL parameters
      if (formData.selectedMixers.length > 0) {
        params.append("mixers", formData.selectedMixers.join(","));
      }

      // Clear the saved draft before redirecting so a future visit starts fresh
      onSuccess?.();

      // Redirect to success page immediately (no alert)
      window.location.href = `/success?${params.toString()}`;
    } catch (error) {
      console.error("Booking submission error:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to confirm booking",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Review & Confirm Your Order
      </h2>

      {/* Trust Signals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/80 dark:bg-charcoal/30 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-8 h-8 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-white">
                100% Satisfaction
              </p>
              <p className="text-xs text-charcoal/70 dark:text-white/70">
                Guaranteed or refund
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-white">
                Secure Booking
              </p>
              <p className="text-xs text-charcoal/70 dark:text-white/70">
                Your data is safe
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-8 h-8 text-orange-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-white">
                On-Time Delivery
              </p>
              <p className="text-xs text-charcoal/70 dark:text-white/70">
                Always punctual
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <div className="relative w-full aspect-square mb-4">
            <Image
              src={
                formData.machineType === "single"
                  ? "/vevor-15l-slushy-2.jpg"
                  : formData.machineType === "double"
                    ? "/vevor-30l-slushy-2.png"
                    : "/vevor-45l-slushy-1.webp"
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
                    {mixerDetails[formData.selectedMixers[0] as MixerType]
                      ?.label ?? formData.selectedMixers[0]}
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
                      {mixerDetails[formData.selectedMixers[0] as MixerType]
                        ?.label ?? formData.selectedMixers[0]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 2:</p>
                  {formData.selectedMixers[1] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[1] as MixerType]
                        ?.label ?? formData.selectedMixers[1]}
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
                      {mixerDetails[formData.selectedMixers[0] as MixerType]
                        ?.label ?? formData.selectedMixers[0]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 2:</p>
                  {formData.selectedMixers[1] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[1] as MixerType]
                        ?.label ?? formData.selectedMixers[1]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 3:</p>
                  {formData.selectedMixers[2] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[2] as MixerType]
                        ?.label ?? formData.selectedMixers[2]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* TABC / BYOB reminder */}
          <p className="text-xs text-charcoal/50 dark:text-white/40 italic mt-2">
            🚫 Alcohol not included — Texas TABC prohibits us from providing it.
            Add your own (max 1.75L per tank) if desired. Please drink
            responsibly.
          </p>

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
              Extras Total: ${formatPrice(extrasTotal)}
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
          <p className="text-charcoal/70 dark:text-white/70">
            Rate: ${formatPrice(perDayRate)}/day × {rentalDays} day
            {rentalDays > 1 ? "s" : ""}
          </p>
          {formData.selectedExtras.length > 0 && (
            <p className="text-charcoal/70 dark:text-white/70">
              Extras: ${formatPrice(extrasTotal)} ($
              {formatPrice(
                formData.selectedExtras.reduce(
                  (sum, item) => sum + item.price * (item.quantity || 1),
                  0,
                ),
              )}
              /day × {rentalDays} day{rentalDays > 1 ? "s" : ""})
            </p>
          )}
          <p className="text-charcoal/70 dark:text-white/70">
            Delivery Fee: ${formatPrice(deliveryFee)}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Subtotal: $
            {formatPrice(perDayRate * rentalDays + deliveryFee + extrasTotal)}
          </p>
          {applyServiceDiscount && (
            <p className="text-charcoal/70 dark:text-white/70">
              Service Discount (10%): -${formatPrice(serviceDiscountAmount)}
            </p>
          )}
          <p className="text-charcoal/70 dark:text-white/70">
            Sales Tax (8.25%): ${formatPrice(salesTax)}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Processing Fee (3%): ${formatPrice(processingFee)}
          </p>
          <p className="text-xl font-bold text-orange mb-4">
            Total Amount: ${formatPrice(finalTotal)}
          </p>

          {/* Service discount checkbox — only visible on review step */}
          <div className="flex items-center space-x-2 mt-4 mb-4">
            <input
              type="checkbox"
              id="serviceDiscount"
              checked={applyServiceDiscount}
              onChange={(e) => {
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

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mt-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Payment Information
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  We will contact you the day before your event to confirm your
                  booking details. Once confirmed, we will send you an invoice
                  that can be paid online. Cash on delivery is also accepted. No
                  deposit is required. All sales are final — no refunds.
                </p>
              </div>
            </div>
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

          {/* Submit Error */}
          {submitError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                {submitError}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6">
            <button
              onClick={handleConfirmBooking}
              disabled={!agreedToTerms || isSubmitting}
              className="w-full bg-gradient-to-r from-orange to-pink hover:from-orange/90 hover:to-pink/90 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                  <span>Confirming Booking...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Confirm Booking</span>
                </span>
              )}
            </button>

            <p className="mt-3 text-xs text-charcoal/60 dark:text-white/60 text-center">
              🔒 No payment required now. We will contact you the day before
              your event to confirm, then send an invoice. Cash on delivery also
              accepted. All sales are final.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
