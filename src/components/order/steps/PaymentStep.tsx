import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { paypalConfig } from "@/config/paypal";
import { StepProps } from "../types";
import { MixerType } from "@/lib/rental-data";
import { calculatePrice, formatPrice } from "@/lib/pricing";

export default function PaymentStep({ formData }: StepProps) {
  const priceBreakdown = calculatePrice(
    formData.machineType,
    formData.selectedMixers[0] as MixerType,
  );

  const rentalDays = Math.ceil(
    (new Date(formData.returnDate).getTime() -
      new Date(formData.rentalDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const total = priceBreakdown.total * rentalDays;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Payment Details
      </h2>
      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
        <p className="text-center text-xl font-bold text-orange mb-6">
          Total Amount: ${formatPrice(total)}
        </p>
        <div className="text-center">
          <PayPalScriptProvider options={paypalConfig}>
            <PayPalCheckout
              amount={total}
              currency="USD"
              rentalData={{
                machineType: formData.machineType,
                capacity: formData.capacity,
                selectedMixers: formData.selectedMixers,
                price: formData.price,
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
