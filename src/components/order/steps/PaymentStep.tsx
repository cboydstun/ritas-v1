import { useState } from "react";
import { StepProps } from "../types";
import { MixerType } from "@/lib/rental-data";
import { calculatePrice, formatPrice } from "@/lib/pricing";

export default function PaymentStep({
  formData,
  isServiceDiscount = false,
}: StepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use isServiceDiscount from formData if available, otherwise use the prop
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

  const handleConfirmBooking = async () => {
    setIsSubmitting(true);

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

      // Redirect to success page immediately (no alert)
      window.location.href = `/success?${params.toString()}`;
    } catch (error) {
      console.error("Booking submission error:", error);
      // Don't use alert - show inline error instead
      setIsSubmitting(false);
      throw error; // This will be caught by the error boundary or shown inline
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Confirm Your Booking
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

      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6 space-y-4">
        <div className="text-center">
          <p className="text-xl font-bold text-orange mb-2">
            Total Amount: ${formatPrice(finalTotal)}
          </p>
          {applyServiceDiscount && (
            <p className="text-sm text-charcoal/70 dark:text-white/70 mb-4">
              Includes 10% service personnel discount
            </p>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
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
                We will send you an invoice for payment after your booking is
                confirmed. You can pay by cash, check, or card when we deliver
                your rental.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={handleConfirmBooking}
            disabled={isSubmitting}
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
            🔒 By confirming, you agree to our terms and conditions. No payment
            required now - pay on delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
