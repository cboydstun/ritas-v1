import Image from "next/image";
import { StepProps } from "../types";
import { mixerDetails } from "@/lib/rental-data";
import { getNextDay } from "../utils";

export function ReviewStep({ formData }: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Review Your Order
      </h2>
      <div className="space-y-4">
        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
          <div className="relative w-full h-[36em] mb-4">
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
            {formData.machineType === "single" ? "Single" : "Double"} Tank Machine
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Mixer Type: {mixerDetails[formData.mixerType].label}
          </p>
          <p className="text-xl font-bold text-orange mt-2">${formData.price}</p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Rental Details
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            Delivery: {new Date(formData.rentalDate).toLocaleDateString()} at{" "}
            {formData.rentalTime}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Pick Up: {getNextDay(new Date(formData.rentalDate)).toLocaleDateString()}{" "}
            at {formData.returnTime}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
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
            {formData.customer.address.street}, {formData.customer.address.city},{" "}
            {formData.customer.address.state} {formData.customer.address.zipCode}
          </p>
        </div>

        <p className="text-center text-xl font-bold text-orange mb-4">
          Total Amount: ${formData.price}
        </p>
      </div>
    </div>
  );
}
