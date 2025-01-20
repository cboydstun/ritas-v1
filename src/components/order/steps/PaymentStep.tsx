import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { paypalConfig } from "@/config/paypal";
import { StepProps } from "../types";
import { getNextDay } from "../utils";

export function PaymentStep({ formData }: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Payment Details
      </h2>
      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
        <div className="text-center">
          <PayPalScriptProvider options={paypalConfig}>
            <PayPalCheckout
              amount={formData.price}
              currency="USD"
              rentalData={{
                machineType: formData.machineType,
                capacity: formData.capacity,
                mixerType: formData.mixerType,
                price: formData.price,
                rentalDate: new Date(formData.rentalDate),
                rentalTime: formData.rentalTime,
                returnDate: getNextDay(new Date(formData.rentalDate)),
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
