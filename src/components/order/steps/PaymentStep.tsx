import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { paypalConfig } from "@/config/paypal";
import { StepProps } from "../types";
import { MixerType } from "@/lib/rental-data";
import { calculatePrice, formatPrice } from "@/lib/pricing";

export default function PaymentStep({
  formData,
  isServiceDiscount = false,
}: StepProps) {
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Payment Details
      </h2>
      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
        <div className="text-center mb-6">
          <p className="text-xl font-bold text-orange">
            Total Amount: ${formatPrice(finalTotal)}
          </p>
          {applyServiceDiscount && (
            <p className="text-sm text-charcoal/70 dark:text-white/70 mt-1">
              Includes 10% service personnel discount
            </p>
          )}
        </div>
        <div className="text-center">
          <PayPalScriptProvider options={paypalConfig}>
            <PayPalCheckout
              amount={finalTotal}
              currency="USD"
              rentalData={{
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
              }}
              onSuccess={(orderId) => {
                // Show success message
                alert("Payment successful! Your rental has been confirmed.");

                // Build URL parameters for the success page
                const params = new URLSearchParams();
                params.append("orderId", orderId);
                params.append("machineType", formData.machineType);

                // Add mixers to URL parameters
                if (formData.selectedMixers.length > 0) {
                  params.append("mixers", formData.selectedMixers.join(","));
                }

                // Redirect to success page
                Promise.resolve().then(() => {
                  window.location.href = `/success?${params.toString()}`;
                });
              }}
              onError={(error: Error) => {
                // Show error message
                alert(`Payment failed: ${error.message}`);
                // Step change will be handled by parent component
              }}
            />
          </PayPalScriptProvider>
        </div>
      </div>
    </div>
  );
}
