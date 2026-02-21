import { useState } from "react";
import { StepProps, inputClassName, labelClassName } from "../types";
import { validateZipCode, isBexarCountyZipCode } from "../utils";

export default function DetailsStep({
  formData,
  onInputChange,
  error,
}: StepProps) {
  const [zipCodeError, setZipCodeError] = useState<string | null>(null);
  const [showZipCodeWarning, setShowZipCodeWarning] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove all non-digits

    if (value.length > 10) {
      value = value.slice(0, 10); // Limit to 10 digits
    }

    // Format the phone number as (XXX)-XXX-XXXX
    if (value.length > 0) {
      if (value.length <= 3) {
        value = `(${value}`;
      } else if (value.length <= 6) {
        value = `(${value.slice(0, 3)})-${value.slice(3)}`;
      } else {
        value = `(${value.slice(0, 3)})-${value.slice(3, 6)}-${value.slice(6)}`;
      }
    }

    // Create a synthetic event to maintain compatibility with the existing onInputChange
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value,
        name: e.target.name,
      },
    };

    onInputChange(syntheticEvent);
  };

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Create a synthetic event to maintain compatibility with the existing onInputChange
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value,
        name: e.target.name,
      },
    };

    // Validate ZIP code format
    if (value && !validateZipCode(value)) {
      setZipCodeError(
        "Please enter a valid ZIP code format (e.g., 78201 or 78201-1234)",
      );
    }
    // Validate if ZIP is in Bexar County
    else if (value && validateZipCode(value) && !isBexarCountyZipCode(value)) {
      setZipCodeError(
        "We only deliver within Bexar County, TX. This ZIP code is outside our delivery area.",
      );
      if (value.length === 5 || value.length > 6) {
        setShowZipCodeWarning(true);
      }
    } else {
      setZipCodeError(null);
    }

    onInputChange(syntheticEvent);
  };

  return (
    <div className="space-y-8 relative">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          Your Details
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Tell us where to deliver your {formData.capacity}L{" "}
          {formData.machineType === "single"
            ? "Single"
            : formData.machineType === "double"
              ? "Double"
              : "Triple"}{" "}
          Tank Machine
        </p>
      </div>

      {/* Prominent delivery area notice */}
      <div className="bg-orange/10 border-l-4 border-orange p-4 rounded-md mb-6">
        <div className="flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-orange mr-2 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-medium text-charcoal dark:text-white">
              Delivery Area Restriction
            </p>
            <p className="text-charcoal/80 dark:text-white/80">
              We only deliver within Bexar County, TX. Orders with delivery
              addresses outside this area cannot be processed.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <div>
            <label className={labelClassName}>Full Name</label>
            <input
              type="text"
              name="customer.name"
              value={formData.customer.name}
              onChange={onInputChange}
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
            onChange={onInputChange}
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
            onChange={handlePhoneChange}
            className={inputClassName}
            placeholder="(123)-456-7890"
            pattern="\(\d{3}\)-\d{3}-\d{4}"
            maxLength={14}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClassName}>Street Address</label>
          <input
            type="text"
            name="customer.address.street"
            value={formData.customer.address.street}
            onChange={onInputChange}
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
            onChange={onInputChange}
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
            readOnly
            className={`${inputClassName} bg-gray-100 dark:bg-gray-700 cursor-default select-none`}
          />
          <p className="text-xs text-charcoal/70 dark:text-white/70 mt-1">
            We only deliver in Texas
          </p>
        </div>

        <div>
          <label className={labelClassName}>ZIP Code</label>
          <div className="relative">
            <input
              type="text"
              name="customer.address.zipCode"
              value={formData.customer.address.zipCode}
              onChange={handleZipCodeChange}
              className={`${inputClassName} ${
                zipCodeError
                  ? "border-red-500 pr-10"
                  : formData.customer.address.zipCode &&
                      validateZipCode(formData.customer.address.zipCode) &&
                      isBexarCountyZipCode(formData.customer.address.zipCode)
                    ? "border-green-500 pr-10"
                    : ""
              }`}
              placeholder="ZIP Code"
            />

            {/* Show error or success icon */}
            {formData.customer.address.zipCode &&
              validateZipCode(formData.customer.address.zipCode) && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {!isBexarCountyZipCode(formData.customer.address.zipCode) ? (
                    <svg
                      className="h-5 w-5 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
              )}
          </div>

          {zipCodeError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-red-400 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{zipCodeError}</span>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className={labelClassName}>Special Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={onInputChange}
            className={inputClassName}
            placeholder="Any special requirements or notes for your rental"
            rows={3}
          />
        </div>

        {/* Add Bexar County visual reference */}
        <div className="md:col-span-2 mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-charcoal dark:text-white">
                Delivery Area
              </h3>
              <p className="text-sm text-charcoal/70 dark:text-white/70">
                We currently only deliver to addresses within Bexar County, TX
                (highlighted area).
              </p>
              <p className="text-sm text-charcoal/70 dark:text-white/70 mt-1">
                This includes San Antonio and surrounding areas with ZIP codes:
                78201-78299 and select others.
              </p>
            </div>
            <div className="hidden md:block">
              {/* Simple SVG outline of Bexar County */}
              <svg
                width="100"
                height="100"
                viewBox="0 0 100 100"
                className="text-orange"
              >
                {/* Simplified Bexar County outline */}
                <path
                  d="M20,20 L80,15 L85,30 L90,60 L70,80 L30,85 L10,70 L15,40 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="50" cy="50" r="3" fill="currentColor" />
                <text
                  x="50"
                  y="65"
                  fontSize="8"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  San Antonio
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ZIP Code Warning Dialog */}
      {showZipCodeWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-charcoal p-6 rounded-lg max-w-md mx-4">
            <div className="flex items-center text-red-600 mb-4">
              <svg
                className="h-8 w-8 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-xl font-bold">Delivery Not Available</h3>
            </div>
            <p className="mb-4">
              Sorry but we can only deliver to addresses within Bexar County,
              TX. The ZIP code you entered ({formData.customer.address.zipCode})
              is outside our delivery area.
            </p>
            <p className="mb-6">
              Please update your address with a valid Bexar County ZIP code to
              continue.
            </p>
            <button
              onClick={() => setShowZipCodeWarning(false)}
              className="w-full py-2 px-4 bg-orange hover:bg-orange/90 text-white rounded-lg"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
    </div>
  );
}
