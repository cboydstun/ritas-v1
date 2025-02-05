"use client";

import { MargaritaRental } from "@/types/index";
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
    await onSave(order._id!, formData);
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
