"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { paypalConfig } from "@/config/paypal";
import {
  mixerDetails,
  machinePackages,
  type MixerOption,
} from "@/lib/rental-data";

type OrderStep = "delivery" | "details" | "review" | "payment";

interface OrderFormData {
  machineType: "single" | "double";
  capacity: 15 | 30;
  mixerType: MixerOption["type"];
  price: number;
  rentalDate: string;
  rentalTime: string;
  returnDate: string;
  returnTime: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  notes: string;
}

const calculatePrice = (
  machineType: "single" | "double",
  mixerType: MixerOption["type"]
) => {
  const machine = machinePackages.find((m) => m.type === machineType);
  const mixer = machine?.mixerOptions.find((m) => m.type === mixerType);
  return mixer?.price ?? 89.95;
};

const getNextDay = (date: Date) => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
};

export default function OrderForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OrderStep>("delivery");

  // Initialize form with URL parameters
  useEffect(() => {
    const machine = searchParams.get("machine") as "single" | "double";
    const mixer = searchParams.get("mixer") as MixerOption["type"];

    if (machine && mixer) {
      const capacity = machine === "single" ? 15 : 30;
      const price = calculatePrice(machine, mixer);

      setFormData((prev) => ({
        ...prev,
        machineType: machine,
        capacity,
        mixerType: mixer,
        price,
      }));
    }
  }, [searchParams]);

  const initialFormState: OrderFormData = {
    machineType: "single",
    capacity: 15,
    mixerType: "none",
    price: 89.95,
    rentalDate: "",
    rentalTime: "",
    returnDate: "",
    returnTime: "",
    customer: {
      name: "",
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
      },
    },
    notes: "",
  };

  const [formData, setFormData] = useState<OrderFormData>(initialFormState);

  const steps: { id: OrderStep; label: string }[] = [
    { id: "delivery", label: "Your Delivery" },
    { id: "details", label: "Your Details" },
    { id: "review", label: "Review Order" },
    { id: "payment", label: "Payment" },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    // Update returnDate when rentalDate changes
    if (name === "rentalDate") {
      const nextDay = getNextDay(new Date(value));
      setFormData((prev: OrderFormData) => ({
        ...prev,
        rentalDate: value,
        returnDate: nextDay.toISOString().split("T")[0],
      }));
      return;
    }

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      if (parent === "customer" && child.includes(".")) {
        // Handle nested address fields
        const [addressField] = child.split(".");
        setFormData((prev: OrderFormData) => ({
          ...prev,
          customer: {
            ...prev.customer,
            address: {
              ...prev.customer.address,
              [addressField]: value,
            },
          },
        }));
      } else {
        // Handle customer fields
        setFormData((prev: OrderFormData) => ({
          ...prev,
          customer: {
            ...prev.customer,
            [child]: value,
          },
        }));
      }
    } else {
      // Handle top-level fields
      setFormData((prev: OrderFormData) => {
        const newData = { ...prev, [name]: value };

        // Update price when machine type or mixer type changes
        if (name === "machineType" || name === "mixerType") {
          const newPrice = calculatePrice(
            name === "machineType"
              ? (value as "single" | "double")
              : prev.machineType,
            name === "mixerType"
              ? (value as MixerOption["type"])
              : prev.mixerType
          );
          return {
            ...newData,
            price: newPrice,
            capacity:
              name === "machineType"
                ? value === "single"
                  ? 15
                  : 30
                : prev.capacity,
          };
        }

        return newData;
      });
    }
  };

  const handleNextStep = () => {
    const currentIndex = steps.findIndex((s) => s.id === step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1].id);
    }
  };

  const inputClassName =
    "w-full px-4 py-3 bg-white dark:bg-white border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors text-charcoal";
  const labelClassName = "block text-charcoal dark:text-white font-medium mb-2";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  steps.findIndex((st) => st.id === step) >= index
                    ? "bg-gradient-to-r from-orange to-pink text-white"
                    : "bg-light dark:bg-charcoal/30 text-charcoal/50 dark:text-white/50"
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 w-[80px] md:w-[200px] lg:w-[200px] ${
                    steps.findIndex((st) => st.id === step) > index
                      ? "bg-gradient-to-r from-orange to-pink"
                      : "bg-light dark:bg-charcoal/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`text-sm ${
                step === s.id
                  ? "text-orange font-medium"
                  : "text-charcoal/50 dark:text-white/50"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Form Steps */}
      <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-lg rounded-2xl shadow-xl p-8 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl" />

        {step === "delivery" && (
          <div className="space-y-8 relative">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
                Select Your Machine
              </h2>
              <p className="text-charcoal/70 dark:text-white/70">
                Choose your perfect frozen drink machine setup
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className={labelClassName}>Machine Type</label>
                <select
                  name="machineType"
                  value={formData.machineType}
                  onChange={handleInputChange}
                  className={inputClassName}
                >
                  <option value="single">15L Single Tank Machine</option>
                  <option value="double">30L Double Tank Machine</option>
                </select>
                <p className="mt-2 text-sm text-charcoal/70 dark:text-white/70">
                  {formData.machineType === "single"
                    ? "Perfect for smaller gatherings and parties"
                    : "Ideal for larger events and multiple flavors"}
                </p>
              </div>

              <div>
                <label className={labelClassName}>Mixer Type</label>
                <select
                  name="mixerType"
                  value={formData.mixerType}
                  onChange={handleInputChange}
                  className={inputClassName}
                >
                  <option value="none">No Mixer</option>
                  <option value="kool-aid">Kool-Aid Mixer</option>
                  <option value="margarita">Margarita Mixer</option>
                  <option value="pina-colada">Piña Colada Mixer</option>
                </select>
                <p className="mt-2 text-sm text-charcoal/70 dark:text-white/70">
                  {formData.mixerType === "none"
                    ? "Bring your own mixer for complete control over your drinks"
                    : formData.mixerType === "kool-aid"
                      ? "Non-alcoholic, perfect for family events"
                      : formData.mixerType === "margarita"
                        ? "Classic margarita mix, just add tequila"
                        : "Tropical piña colada mix, just add rum"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClassName}>Delivery Date</label>
                  <input
                    type="date"
                    name="rentalDate"
                    value={formData.rentalDate}
                    onChange={handleInputChange}
                    className={inputClassName}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Delivery Time</label>
                  <input
                    type="time"
                    name="rentalTime"
                    value={formData.rentalTime}
                    onChange={handleInputChange}
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Pick Up Date</label>
                  <input
                    type="date"
                    name="returnDate"
                    value={formData.returnDate}
                    onChange={handleInputChange}
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Pick Up Time</label>
                  <input
                    type="time"
                    name="returnTime"
                    value={formData.returnTime}
                    onChange={handleInputChange}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-xl font-bold text-orange">
                  Total: ${formData.price}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-8 relative">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
                Your Details
              </h2>
              <p className="text-charcoal/70 dark:text-white/70">
                Tell us where to deliver your {formData.capacity}L{" "}
                {formData.machineType === "single" ? "Single" : "Double"} Tank
                Machine
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <div>
                  <label className={labelClassName}>Full Name</label>
                  <input
                    type="text"
                    name="customer.name"
                    value={formData.customer.name}
                    onChange={handleInputChange}
                    className={inputClassName}
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <label className={labelClassName}>Email</label>
                <input
                  type="email"
                  name="customer.email"
                  value={formData.customer.email}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className={labelClassName}>Phone</label>
                <input
                  type="tel"
                  name="customer.phone"
                  value={formData.customer.phone}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="(123) 456-7890"
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClassName}>Street Address</label>
                <input
                  type="text"
                  name="customer.address.street"
                  value={formData.customer.address.street}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="Enter your street address"
                />
              </div>

              <div>
                <label className={labelClassName}>City</label>
                <input
                  type="text"
                  name="customer.address.city"
                  value={formData.customer.address.city}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="City"
                />
              </div>

              <div>
                <label className={labelClassName}>State</label>
                <input
                  type="text"
                  name="customer.address.state"
                  value={formData.customer.address.state}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="State"
                />
              </div>

              <div>
                <label className={labelClassName}>ZIP Code</label>
                <input
                  type="text"
                  name="customer.address.zipCode"
                  value={formData.customer.address.zipCode}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="ZIP Code"
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClassName}>Special Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className={inputClassName}
                  placeholder="Any special requirements or notes for your rental"
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
              Review Your Order
            </h2>
            <div className="space-y-4">
              <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
                <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                  Selected Machine
                </h3>
                <p className="text-charcoal/70 dark:text-white/70">
                  {formData.capacity}L{" "}
                  {formData.machineType === "single" ? "Single" : "Double"} Tank
                  Machine
                </p>
                <p className="text-charcoal/70 dark:text-white/70">
                  Mixer Type: {mixerDetails[formData.mixerType].label}
                </p>
                <p className="text-xl font-bold text-orange mt-2">
                  ${formData.price}
                </p>
              </div>

              <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
                <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                  Rental Details
                </h3>
                <p className="text-charcoal/70 dark:text-white/70">
                  Delivery: {new Date(formData.rentalDate).toLocaleDateString()}{" "}
                  at {formData.rentalTime}
                </p>
                <p className="text-charcoal/70 dark:text-white/70">
                  Pick Up:{" "}
                  {getNextDay(
                    new Date(formData.rentalDate)
                  ).toLocaleDateString()}{" "}
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
                  {formData.customer.address.street},{" "}
                  {formData.customer.address.city},{" "}
                  {formData.customer.address.state}{" "}
                  {formData.customer.address.zipCode}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
              Payment Details
            </h2>
            <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
              <p className="text-center text-xl font-bold text-orange mb-4">
                Total Amount: ${formData.price}
              </p>
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
                      alert(
                        "Payment successful! Your rental has been confirmed."
                      );
                      // Reset form state and step in a single batch
                      Promise.resolve().then(() => {
                        setFormData(initialFormState);
                        setStep("delivery");
                      });
                    }}
                    onError={(error: Error) => {
                      // Show error message
                      alert(`Payment failed: ${error.message}`);
                      setStep("review");
                    }}
                  />
                </PayPalScriptProvider>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === step);
              if (currentIndex > 0) {
                setStep(steps[currentIndex - 1].id);
              }
            }}
            className={`px-8 py-3 rounded-xl font-bold transition-all duration-300 ${
              step === "delivery"
                ? "invisible"
                : "bg-light dark:bg-charcoal/30 text-charcoal dark:text-white hover:bg-light/80 dark:hover:bg-charcoal/50 hover:-translate-y-1"
            }`}
          >
            Previous
          </button>
          <button
            onClick={handleNextStep}
            className="px-8 py-3 bg-gradient-to-r from-orange to-pink text-white rounded-xl font-bold
              hover:shadow-lg hover:shadow-orange/30 transform hover:-translate-y-1 transition-all duration-300"
          >
            {step === "payment" ? "Complete Order" : "Next Step"}
          </button>
        </div>
      </div>
    </div>
  );
}
