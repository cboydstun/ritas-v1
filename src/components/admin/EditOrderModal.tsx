"use client";

import { MargaritaRental, MachineType, MixerType } from "@/types/index";
import { useState } from "react";

interface EditOrderModalProps {
  order: MargaritaRental;
  onClose: () => void;
  onSave: (orderId: string, data: Partial<MargaritaRental>) => Promise<void>;
}

export default function EditOrderModal({
  order,
  onClose,
  onSave,
}: EditOrderModalProps) {
  const [formData, setFormData] = useState({
    notes: order.notes || "",
    machineType: order.machineType,
    capacity: order.capacity,
    selectedMixers: order.selectedMixers,
    rentalDate: order.rentalDate,
    rentalTime: order.rentalTime,
    returnDate: order.returnDate,
    returnTime: order.returnTime,
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      address: {
        street: order.customer.address.street,
        city: order.customer.address.city,
        state: order.customer.address.state,
        zipCode: order.customer.address.zipCode,
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data for submission
    const updatedData: Partial<MargaritaRental> = {
      notes: formData.notes,
      machineType: formData.machineType,
      capacity: formData.capacity,
      selectedMixers: formData.selectedMixers,
      rentalDate: formData.rentalDate,
      rentalTime: formData.rentalTime,
      returnDate: formData.returnDate,
      returnTime: formData.returnTime,
      customer: formData.customer,
    };

    await onSave(order._id!, updatedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Edit Order
        </h2>
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        machineType: e.target.value as MachineType,
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  >
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Capacity (L)
                  </label>
                  <select
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        capacity: parseInt(e.target.value) as 15 | 30,
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  >
                    <option value="15">15L</option>
                    <option value="30">30L</option>
                  </select>
                </div>
                {formData.machineType === "single" ? (
                  // Single Tank Mixer Selection
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Mixer Type
                    </label>
                    <select
                      value={formData.selectedMixers[0] || "machine-only"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          selectedMixers: [e.target.value as MixerType],
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    >
                      <option value="machine-only">Machine Only</option>
                      <option value="non-alcoholic">Non-Alcoholic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                ) : (
                  // Double Tank Mixer Selection
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tank 1 Mixer
                      </label>
                      <select
                        value={formData.selectedMixers[0] || "machine-only"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            selectedMixers: [
                              e.target.value as MixerType,
                              formData.selectedMixers[1] || "machine-only",
                            ],
                          })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      >
                        <option value="machine-only">Machine Only</option>
                        <option value="non-alcoholic">Non-Alcoholic</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tank 2 Mixer
                      </label>
                      <select
                        value={formData.selectedMixers[1] || "machine-only"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            selectedMixers: [
                              formData.selectedMixers[0] || "machine-only",
                              e.target.value as MixerType,
                            ],
                          })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      >
                        <option value="machine-only">Machine Only</option>
                        <option value="non-alcoholic">Non-Alcoholic</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                  </>
                )}
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
                    Rental Date
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
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rental Time
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
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Return Date
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
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Return Time
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
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.customer.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          name: e.target.value,
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.customer.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          email: e.target.value,
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.customer.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          phone: e.target.value,
                        },
                      })
                    }
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
                    Street
                  </label>
                  <input
                    type="text"
                    value={formData.customer.address.street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          address: {
                            ...formData.customer.address,
                            street: e.target.value,
                          },
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.customer.address.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          address: {
                            ...formData.customer.address,
                            city: e.target.value,
                          },
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.customer.address.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          address: {
                            ...formData.customer.address,
                            state: e.target.value,
                          },
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={formData.customer.address.zipCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer: {
                          ...formData.customer,
                          address: {
                            ...formData.customer.address,
                            zipCode: e.target.value,
                          },
                        },
                      })
                    }
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
                value={formData.notes}
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
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal hover:bg-teal-700 text-white rounded-md transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
