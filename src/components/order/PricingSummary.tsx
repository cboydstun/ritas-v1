import { OrderFormData, OrderStep } from "./types";
import { calculatePrice, formatPrice } from "@/lib/pricing";

interface PricingSummaryProps {
  formData: OrderFormData;
  currentStep?: OrderStep;
}

export function PricingSummary({ formData, currentStep }: PricingSummaryProps) {
  // Issue 1: pass selectedMixers array instead of selectedMixers[0]
  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers,
  );

  const perDayRate = priceBreakdown.basePrice + priceBreakdown.mixerPrice;

  const rentalDays =
    formData.rentalDate && formData.returnDate
      ? Math.max(
          1,
          Math.ceil(
            (new Date(formData.returnDate + "T00:00:00").getTime() -
              new Date(formData.rentalDate + "T00:00:00").getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1;

  // Calculate extras total
  const extrasTotal = formData.selectedExtras.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1) * rentalDays,
    0,
  );

  const subtotal =
    perDayRate * rentalDays + priceBreakdown.deliveryFee + extrasTotal;

  // Issue 3: read exclusively from formData.isServiceDiscount
  const serviceDiscountAmount = formData.isServiceDiscount ? subtotal * 0.1 : 0;
  const discountedSubtotal = subtotal - serviceDiscountAmount;

  const salesTax = discountedSubtotal * 0.0825;
  const processingFee = discountedSubtotal * 0.03;
  const finalTotal = discountedSubtotal + salesTax + processingFee;

  return (
    <div className="bg-white/95 dark:bg-charcoal/95 backdrop-blur-lg rounded-xl shadow-lg p-6 border-2 border-margarita/20">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-margarita/20">
        <h3 className="text-lg font-bold text-charcoal dark:text-white">
          Order Summary
        </h3>
        <div className="flex items-center space-x-1">
          <svg
            className="w-5 h-5 text-margarita"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Placeholder shown on date step before a machine has been chosen */}
      {currentStep === "date" && (
        <div className="text-center py-6 text-charcoal/50 dark:text-white/50">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-margarita/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm font-medium">Select your machine</p>
          <p className="text-xs mt-1">Pricing will appear on the next step.</p>
        </div>
      )}

      {/* Full breakdown shown from machine step onwards */}
      {currentStep !== "date" && (
        <div className="space-y-3 text-sm">
          {/* Machine */}
          <div className="flex justify-between">
            <span className="text-charcoal/70 dark:text-white/70">
              {formData.capacity}L{" "}
              {formData.machineType === "single"
                ? "Single"
                : formData.machineType === "double"
                  ? "Double"
                  : "Triple"}{" "}
              Tank
            </span>
            <span className="font-medium text-charcoal dark:text-white">
              ${formatPrice(priceBreakdown.basePrice)}/day
            </span>
          </div>

          {/* Mixers */}
          {formData.selectedMixers.length > 0 && (
            <div className="flex justify-between">
              <span className="text-charcoal/70 dark:text-white/70">
                {formData.selectedMixers.length} Mixer
                {formData.selectedMixers.length > 1 ? "s" : ""}
              </span>
              <span className="font-medium text-charcoal dark:text-white">
                ${formatPrice(priceBreakdown.mixerPrice)}/day
              </span>
            </div>
          )}

          {/* Rental Days */}
          {formData.rentalDate && formData.returnDate && (
            <div className="flex justify-between text-xs pt-2 border-t border-margarita/10">
              <span className="text-charcoal/60 dark:text-white/60">
                × {rentalDays} day{rentalDays > 1 ? "s" : ""}
              </span>
              <span className="font-medium text-charcoal dark:text-white">
                ${formatPrice(perDayRate * rentalDays)}
              </span>
            </div>
          )}

          {/* Extras */}
          {formData.selectedExtras.length > 0 && (
            <>
              <div className="pt-2 border-t border-margarita/10">
                <div className="text-xs font-semibold text-charcoal/80 dark:text-white/80 mb-2">
                  Party Extras:
                </div>
                {formData.selectedExtras.map((extra) => (
                  <div key={extra.id} className="flex justify-between mb-1">
                    <span className="text-charcoal/70 dark:text-white/70 text-xs">
                      {extra.name}
                      {extra.quantity && extra.quantity > 1
                        ? ` (${extra.quantity}x)`
                        : ""}
                    </span>
                    <span className="text-charcoal dark:text-white text-xs">
                      $
                      {formatPrice(
                        extra.price * (extra.quantity || 1) * rentalDays,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Delivery Fee */}
          <div className="flex justify-between pt-2 border-t border-margarita/10">
            <span className="text-charcoal/70 dark:text-white/70">
              Delivery & Setup
            </span>
            <span className="font-medium text-charcoal dark:text-white">
              ${formatPrice(priceBreakdown.deliveryFee)}
            </span>
          </div>

          {/* Service Discount */}
          {formData.isServiceDiscount && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Service Discount (10%)</span>
              <span>-${formatPrice(serviceDiscountAmount)}</span>
            </div>
          )}

          {/* Tax */}
          <div className="flex justify-between">
            <span className="text-charcoal/70 dark:text-white/70">
              Sales Tax (8.25%)
            </span>
            <span className="font-medium text-charcoal dark:text-white">
              ${formatPrice(salesTax)}
            </span>
          </div>

          {/* Processing Fee */}
          <div className="flex justify-between">
            <span className="text-charcoal/70 dark:text-white/70">
              Processing Fee (3%)
            </span>
            <span className="font-medium text-charcoal dark:text-white">
              ${formatPrice(processingFee)}
            </span>
          </div>

          {/* Total */}
          <div className="flex justify-between pt-4 border-t-2 border-margarita/30">
            <span className="text-lg font-bold text-charcoal dark:text-white">
              Total
            </span>
            <span className="text-2xl font-bold text-orange">
              ${formatPrice(finalTotal)}
            </span>
          </div>
        </div>
      )}

      {/* Trust badge */}
      <div className="mt-4 pt-4 border-t border-margarita/10">
        <div className="flex items-center justify-center space-x-2 text-xs text-charcoal/60 dark:text-white/60">
          <svg
            className="w-4 h-4 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Secure Booking • Pay on Delivery</span>
        </div>
      </div>
    </div>
  );
}
