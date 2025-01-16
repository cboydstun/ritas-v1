"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  mixerDetails,
  machinePackages,
  type MixerOption,
} from "@/lib/rental-data";

type OrderStep = "details" | "review" | "payment";

interface OrderFormData {
  machineType: "single" | "double";
  capacity: 15 | 30;
  mixerType: MixerOption["type"];
  price: number;
  rentalDate: string;
  returnDate: string;
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

export default function OrderForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OrderStep>("details");

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
  const [formData, setFormData] = useState<OrderFormData>({
    machineType: "single",
    capacity: 15,
    mixerType: "none",
    price: 89.95,
    rentalDate: "",
    returnDate: "",
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
  });

  const steps: { id: OrderStep; label: string }[] = [
    { id: "details", label: "Your Details" },
    { id: "review", label: "Review Order" },
    { id: "payment", label: "Payment" },
  ];

  const handlePackageSelect = (
    machineType: "single" | "double",
    mixerType: MixerOption["type"]
  ) => {
    const capacity = machineType === "single" ? 15 : 30;
    const price = calculatePrice(machineType, mixerType);

    setFormData((prev) => ({
      ...prev,
      machineType,
      capacity,
      mixerType,
      price,
    }));
    setStep("details");
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      if (parent === "customer" && child.includes(".")) {
        // Handle nested address fields
        const [_, addressField] = child.split(".");
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
      setFormData((prev: OrderFormData) => ({ ...prev, [name]: value }));
    }
  };

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
                    : "bg-light text-charcoal/50"
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 w-32 ${
                    steps.findIndex((st) => st.id === step) > index
                      ? "bg-gradient-to-r from-orange to-pink"
                      : "bg-light"
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
                step === s.id ? "text-orange font-medium" : "text-charcoal/50"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Form Steps */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-8 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-margarita/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange/10 rounded-full blur-2xl" />

        {step === "details" && (
          <div className="space-y-8 relative">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-charcoal mb-2">
                Your Rental Details
              </h2>
              <p className="text-charcoal/70">
                Selected: {formData.capacity}L{" "}
                {formData.machineType === "single" ? "Single" : "Double"} Tank
                Machine with {mixerDetails[formData.mixerType].label} - $
                {formData.price}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <div className="space-y-6 mb-6">
                  <div>
                    <label className="block text-charcoal font-medium mb-2">
                      Machine Type
                    </label>
                    <select
                      name="machineType"
                      value={formData.machineType}
                      onChange={(e) => {
                        const newMachineType = e.target.value as
                          | "single"
                          | "double";
                        const capacity = newMachineType === "single" ? 15 : 30;
                        const price = calculatePrice(
                          newMachineType,
                          formData.mixerType
                        );
                        setFormData((prev) => ({
                          ...prev,
                          machineType: newMachineType,
                          capacity,
                          price,
                        }));
                      }}
                      className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                    >
                      <option value="single">15L Single Tank Machine</option>
                      <option value="double">30L Double Tank Machine</option>
                    </select>
                    <p className="mt-2 text-sm text-charcoal/70">
                      {formData.machineType === "single"
                        ? "Perfect for smaller gatherings and parties"
                        : "Ideal for larger events and multiple flavors"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-charcoal font-medium mb-2">
                      Mixer Type
                    </label>
                    <select
                      name="mixerType"
                      value={formData.mixerType}
                      onChange={(e) => {
                        const newMixerType = e.target
                          .value as MixerOption["type"];
                        const price = calculatePrice(
                          formData.machineType,
                          newMixerType
                        );
                        setFormData((prev) => ({
                          ...prev,
                          mixerType: newMixerType,
                          price,
                        }));
                      }}
                      className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                    >
                      <option value="none">No Mixer</option>
                      <option value="kool-aid">Kool-Aid Mixer</option>
                      <option value="margarita">Margarita Mixer</option>
                      <option value="pina-colada">Piña Colada Mixer</option>
                    </select>
                    <p className="mt-2 text-sm text-charcoal/70">
                      {formData.mixerType === "none"
                        ? "Bring your own mixer for complete control over your drinks"
                        : formData.mixerType === "kool-aid"
                        ? "Non-alcoholic, perfect for family events"
                        : formData.mixerType === "margarita"
                        ? "Classic margarita mix, just add tequila"
                        : "Tropical piña colada mix, just add rum"}
                    </p>
                  </div>
                </div>

                <label className="block text-charcoal font-medium mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="customer.name"
                  value={formData.customer.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="customer.email"
                  value={formData.customer.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="your@email.com"
                  required
                  pattern="^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$"
                />
              </div>

              <div>
                <label className="block text-charcoal font-medium mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="customer.phone"
                  value={formData.customer.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="(123) 456-7890"
                  required
                  pattern="^(\+?[\d\s\-()]{7,16})?$"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-charcoal font-medium mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  name="customer.address.street"
                  value={formData.customer.address.street}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="Enter your street address"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal font-medium mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="customer.address.city"
                  value={formData.customer.address.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="City"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal font-medium mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="customer.address.state"
                  value={formData.customer.address.state}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="State"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal font-medium mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  name="customer.address.zipCode"
                  value={formData.customer.address.zipCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="ZIP Code"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal font-medium mb-2">
                  Rental Date
                </label>
                <input
                  type="date"
                  name="rentalDate"
                  value={formData.rentalDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-charcoal font-medium mb-2">
                  Special Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-light/50 border-2 border-transparent rounded-xl focus:outline-none focus:border-orange/50 transition-colors"
                  placeholder="Any special requirements or notes for your rental"
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-charcoal mb-6">
              Review Your Order
            </h2>
            <div className="space-y-4">
              <div className="bg-light/50 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-4">Selected Machine</h3>
                <p className="text-charcoal/70">
                  {formData.capacity}L{" "}
                  {formData.machineType === "single" ? "Single" : "Double"} Tank
                  Machine
                </p>
                <p className="text-charcoal/70">
                  Mixer Type: {mixerDetails[formData.mixerType].label}
                </p>
                <p className="text-xl font-bold text-orange mt-2">
                  ${formData.price}
                </p>
              </div>

              <div className="bg-light/50 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-4">Rental Details</h3>
                <p className="text-charcoal/70">
                  Rental Date: {formData.rentalDate}
                </p>
                <p className="text-charcoal/70">Return Date: Next day</p>
              </div>

              <div className="bg-light/50 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-4">
                  Contact Information
                </h3>
                <p className="text-charcoal/70">{formData.customer.name}</p>
                <p className="text-charcoal/70">{formData.customer.email}</p>
                <p className="text-charcoal/70">{formData.customer.phone}</p>
                <p className="text-charcoal/70">
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
            <h2 className="text-2xl font-bold text-charcoal mb-6">
              Payment Details
            </h2>
            <div className="bg-light/50 rounded-xl p-6">
              <p className="text-center text-xl font-bold text-orange mb-4">
                Total Amount: ${formData.price}
              </p>
              <div className="text-center">
                {/* PayPal integration would go here */}
                <p className="text-charcoal/70 mb-4">
                  Proceed to PayPal to complete your order
                </p>
                <button className="px-8 py-3 bg-[#0070BA] text-white rounded-xl font-bold hover:bg-[#003087] transition-colors">
                  Pay with PayPal
                </button>
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
              step === "details"
                ? "invisible"
                : "bg-light text-charcoal hover:bg-light/80 hover:-translate-y-1"
            }`}
          >
            Previous
          </button>
          <button
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === step);
              if (currentIndex < steps.length - 1) {
                setStep(steps[currentIndex + 1].id);
              }
            }}
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
