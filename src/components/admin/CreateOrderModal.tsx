"use client";

import { useState, useEffect } from "react";
import { MargaritaRental, MachineType, MixerType } from "@/types/index";
import { machinePackages, mixerDetails } from "@/lib/rental-data";
import { extraItems } from "@/components/order/types";
import { formatPrice } from "@/lib/pricing";

// Constants for fee calculations
const DELIVERY_FEE = 20;
const SALES_TAX_RATE = 0.0825;
const PROCESSING_FEE_RATE = 0.03;

interface CreateOrderModalProps {
  onClose: () => void;
}

export default function CreateOrderModal({ onClose }: CreateOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<MargaritaRental>>({
    machineType: "single",
    capacity: 15,
    selectedMixers: [],
    selectedExtras: [],
    price: machinePackages[0].basePrice, // Default to the base price of the first machine package
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
    status: "pending",
  });

  // Calculate rental days between rental and return dates
  const calculateRentalDays = () => {
    if (!formData.rentalDate || !formData.returnDate) return 1;
    
    const rentalDate = new Date(formData.rentalDate + "T00:00:00");
    const returnDate = new Date(formData.returnDate + "T00:00:00");
    
    if (isNaN(rentalDate.getTime()) || isNaN(returnDate.getTime())) return 1;
    
    const diffTime = returnDate.getTime() - rentalDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays); // Ensure at least 1 day
  };

  // Define the price details interface
  interface PriceDetails {
    basePrice: number;
    mixerPrice: number;
    perDayRate: number;
    rentalDays: number;
    extrasTotal: number;
    deliveryFee: number;
    subtotal: number;
    salesTax: number;
    processingFee: number;
    total: number;
  }

  // Calculate the total price based on selected machine, mixers, extras, and fees
  const calculateTotalPrice = (): PriceDetails => {
    // Find the selected machine package
    const selectedMachine = machinePackages.find(
      (pkg) => pkg.type === formData.machineType && pkg.capacity === formData.capacity
    );
    
    // Default values if no machine is selected
    if (!selectedMachine) {
      return {
        basePrice: 0,
        mixerPrice: 0,
        perDayRate: 0,
        rentalDays: 1,
        extrasTotal: 0,
        deliveryFee: DELIVERY_FEE,
        subtotal: DELIVERY_FEE,
        salesTax: DELIVERY_FEE * SALES_TAX_RATE,
        processingFee: DELIVERY_FEE * PROCESSING_FEE_RATE,
        total: DELIVERY_FEE * (1 + SALES_TAX_RATE + PROCESSING_FEE_RATE)
      };
    }
    
    // Calculate rental days
    const rentalDays = calculateRentalDays();
    
    // Start with the base price
    const basePrice = selectedMachine.basePrice;
    
    // Add mixer prices
    let mixerPrice = 0;
    if (formData.selectedMixers && formData.selectedMixers.length > 0) {
      formData.selectedMixers.forEach((mixer) => {
        const mixerDetail = mixerDetails[mixer as MixerType];
        if (mixerDetail) {
          mixerPrice += mixerDetail.price;
        }
      });
    }
    
    // Calculate per day rate
    const perDayRate = basePrice + mixerPrice;
    
    // Add extras prices (per day × number of days)
    let extrasTotal = 0;
    if (formData.selectedExtras && formData.selectedExtras.length > 0) {
      formData.selectedExtras.forEach((extra) => {
        extrasTotal += extra.price * (extra.quantity || 1) * rentalDays;
      });
    }
    
    // Calculate subtotal including delivery fee
    const subtotal = perDayRate * rentalDays + DELIVERY_FEE + extrasTotal;
    
    // Calculate tax and processing fee
    const salesTax = subtotal * SALES_TAX_RATE;
    const processingFee = subtotal * PROCESSING_FEE_RATE;
    
    // Calculate final total
    const total = subtotal + salesTax + processingFee;
    
    return {
      basePrice,
      mixerPrice,
      perDayRate,
      rentalDays,
      extrasTotal,
      deliveryFee: DELIVERY_FEE,
      subtotal,
      salesTax,
      processingFee,
      total
    };
  };

  // Use effect to update price whenever relevant form fields change
  useEffect(() => {
    const priceDetails = calculateTotalPrice();
    setFormData((prev) => ({
      ...prev,
      price: priceDetails.total,
    }));
  }, [formData.machineType, formData.capacity, formData.selectedMixers, formData.selectedExtras, formData.rentalDate, formData.returnDate, calculateTotalPrice]);

  // Handle machine type change
  const handleMachineTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as MachineType;
    
    // Find the first package with the selected type
    const newPackage = machinePackages.find((pkg) => pkg.type === newType);
    
    if (newPackage) {
      setFormData((prev) => ({
        ...prev,
        machineType: newType,
        capacity: newPackage.capacity,
        // Reset mixers when changing machine type
        selectedMixers: [],
      }));
    }
  };

  // Handle capacity change
  const handleCapacityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCapacity = parseInt(e.target.value) as 15 | 30 | 45;
    
    setFormData((prev) => ({
      ...prev,
      capacity: newCapacity,
    }));
  };

  // Handle mixer selection
  const handleMixerChange = (index: number, value: MixerType) => {
    const newMixers = [...(formData.selectedMixers || [])];
    
    if (index >= newMixers.length) {
      // Add new mixer
      newMixers.push(value);
    } else {
      // Update existing mixer
      newMixers[index] = value;
    }
    
    setFormData((prev) => ({
      ...prev,
      selectedMixers: newMixers,
    }));
  };

  // Handle extra item selection
  const handleExtraItemToggle = (itemId: string) => {
    const item = extraItems.find((item) => item.id === itemId);
    if (!item) return;
    
    const currentExtras = formData.selectedExtras || [];
    const itemIndex = currentExtras.findIndex((extra) => extra.id === itemId);
    
    let newExtras;
    if (itemIndex === -1) {
      // Add the item
      newExtras = [...currentExtras, { ...item, quantity: 1 }];
    } else {
      // Remove the item
      newExtras = currentExtras.filter((extra) => extra.id !== itemId);
    }
    
    setFormData((prev) => ({
      ...prev,
      selectedExtras: newExtras,
    }));
  };

  // Handle extra item quantity change
  const handleExtraQuantityChange = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    
    const currentExtras = formData.selectedExtras || [];
    const itemIndex = currentExtras.findIndex((extra) => extra.id === itemId);
    
    if (itemIndex === -1) return;
    
    const newExtras = [...currentExtras];
    newExtras[itemIndex] = { ...newExtras[itemIndex], quantity };
    
    setFormData((prev) => ({
      ...prev,
      selectedExtras: newExtras,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.rentalDate || !formData.rentalTime || !formData.returnDate || !formData.returnTime) {
        throw new Error("Please fill in all rental date and time fields");
      }

      if (!formData.customer?.name || !formData.customer?.email || !formData.customer?.phone) {
        throw new Error("Please fill in all customer information fields");
      }

      if (
        !formData.customer?.address?.street ||
        !formData.customer?.address?.city ||
        !formData.customer?.address?.state ||
        !formData.customer?.address?.zipCode
      ) {
        throw new Error("Please fill in all address fields");
      }

      // Use the current price from state
      const finalFormData = {
        ...formData,
        status: "pending" as const,
      };

      // Submit the form data
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      // Close the modal and refresh the orders list
      onClose();
      // Force a refresh of the orders table
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Get the maximum number of mixers based on the selected machine type
  const getMaxMixers = () => {
    const selectedMachine = machinePackages.find(
      (pkg) => pkg.type === formData.machineType && pkg.capacity === formData.capacity
    );
    return selectedMachine ? selectedMachine.maxMixers : 1;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Create New Order
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Machine Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Machine Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Machine Type
                  </label>
                  <select
                    value={formData.machineType}
                    onChange={handleMachineTypeChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  >
                    {machinePackages.map((pkg) => (
                      <option key={`${pkg.type}-${pkg.capacity}`} value={pkg.type}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Capacity (L)
                  </label>
                  <select
                    value={formData.capacity}
                    onChange={handleCapacityChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  >
                    {machinePackages
                      .filter((pkg) => pkg.type === formData.machineType)
                      .map((pkg) => (
                        <option key={`capacity-${pkg.capacity}`} value={pkg.capacity}>
                          {pkg.capacity}L
                        </option>
                      ))}
                  </select>
                </div>
                
                {/* Mixer Selection */}
                {Array.from({ length: getMaxMixers() }).map((_, index) => (
                  <div key={`mixer-${index}`}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {getMaxMixers() > 1 ? `Tank ${index + 1} Mixer` : "Mixer Type"}
                    </label>
                    <select
                      value={formData.selectedMixers?.[index] || ""}
                      onChange={(e) => handleMixerChange(index, e.target.value as MixerType)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    >
                      <option value="">Select a mixer</option>
                      {Object.entries(mixerDetails).map(([key, mixer]) => (
                        <option key={`mixer-${key}-${index}`} value={key}>
                          {mixer.label} (${mixer.price.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Extras */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Extra Items
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {extraItems.map((item) => (
                  <div key={item.id} className="flex items-start space-x-3 p-3 border rounded-md">
                    <input
                      type="checkbox"
                      id={`extra-${item.id}`}
                      checked={Boolean(formData.selectedExtras?.some((extra) => extra.id === item.id))}
                      onChange={() => handleExtraItemToggle(item.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor={`extra-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {item.name} (${item.price.toFixed(2)})
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                      
                      {item.allowQuantity && formData.selectedExtras?.some((extra) => extra.id === item.id) && (
                        <div className="mt-2 flex items-center space-x-2">
                          <label className="text-xs text-gray-700 dark:text-gray-300">Quantity:</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.selectedExtras?.find((extra) => extra.id === item.id)?.quantity || 1}
                            onChange={(e) => handleExtraQuantityChange(item.id, parseInt(e.target.value))}
                            className="w-16 text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rental Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Rental Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rental Date *
                  </label>
                  <input
                    type="date"
                    value={formData.rentalDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rentalDate: e.target.value,
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rental Time *
                  </label>
                  <input
                    type="time"
                    value={formData.rentalTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rentalTime: e.target.value,
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Return Date *
                  </label>
                  <input
                    type="date"
                    value={formData.returnDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        returnDate: e.target.value,
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Return Time *
                  </label>
                  <input
                    type="time"
                    value={formData.returnTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        returnTime: e.target.value,
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Customer Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customer?.name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          name: e.target.value,
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.customer?.email || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          email: e.target.value,
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.customer?.phone || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          phone: e.target.value,
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Street *
                  </label>
                  <input
                    type="text"
                    value={formData.customer?.address?.street || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          address: {
                            ...formData.customer!.address,
                            street: e.target.value,
                          },
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.customer?.address?.city || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          address: {
                            ...formData.customer!.address,
                            city: e.target.value,
                          },
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.customer?.address?.state || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          address: {
                            ...formData.customer!.address,
                            state: e.target.value,
                          },
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={formData.customer?.address?.zipCode || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer!,
                          address: {
                            ...formData.customer!.address,
                            zipCode: e.target.value,
                          },
                        },
                      })
                    }
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>
              <textarea
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notes: e.target.value,
                  })
                }
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              />
            </div>

            {/* Order Summary */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Order Summary
              </h3>
              
              {/* Price Breakdown */}
              {formData.rentalDate && formData.returnDate && (
                <div className="space-y-1 mb-4">
                  {(() => {
                    const priceDetails = calculateTotalPrice();
                    return (
                      <>
                        <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>Machine Rate:</span>
                          <span>${formatPrice(priceDetails.perDayRate)}/day × {priceDetails.rentalDays} day{priceDetails.rentalDays > 1 ? 's' : ''}</span>
                        </div>
                        
                        {formData.selectedExtras && formData.selectedExtras.length > 0 && (
                          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                            <span>Extras:</span>
                            <span>${formatPrice(priceDetails.extrasTotal)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>Delivery Fee:</span>
                          <span>${formatPrice(priceDetails.deliveryFee)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>Subtotal:</span>
                          <span>${formatPrice(priceDetails.subtotal)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>Sales Tax (8.25%):</span>
                          <span>${formatPrice(priceDetails.salesTax)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>Processing Fee (3%):</span>
                          <span>${formatPrice(priceDetails.processingFee)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  Total: ${formData.price?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal hover:bg-teal-700 text-white rounded-md transition-colors"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
