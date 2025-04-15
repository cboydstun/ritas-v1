import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { paypalConfig } from "@/config/paypal";
import { StepProps } from "../types";
import { MixerType } from "@/lib/rental-data";
import { calculatePrice, formatPrice } from "@/lib/pricing";

export default function PaymentStep({ formData }: StepProps) {
  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers[0] as MixerType
  );

  const perDayRate = priceBreakdown.basePrice + priceBreakdown.mixerPrice;

  const rentalDays = Math.max(
    1,
    Math.ceil(
      (new Date(formData.returnDate).getTime() -
        new Date(formData.rentalDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  // Calculate extras total (per day × number of days)
  const extrasTotal = formData.selectedExtras.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1) * rentalDays,
    0
  );

  // Recalculate subtotal including extras
  const subtotal =
    perDayRate * rentalDays + priceBreakdown.deliveryFee + extrasTotal;

  // Recalculate tax and processing fee based on the new subtotal
  const salesTax = subtotal * 0.0825; // 8.25% tax rate
  const processingFee = subtotal * 0.03; // 3% processing fee

  // Calculate the final total including extras
  const finalTotal = subtotal + salesTax + processingFee;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Payment Details
      </h2>
      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
        <p className="text-center text-xl font-bold text-orange mb-6">
          Total Amount: ${formatPrice(finalTotal)}
        </p>
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
              }}
              onSuccess={() => {
                // Show success message
                alert("Payment successful! Your rental has been confirmed.");
                // Reset form state and step in a single batch
                Promise.resolve().then(() => {
                  // These will be handled by the parent component
                  window.location.href = "/";
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
