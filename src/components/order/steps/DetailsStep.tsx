import { StepProps, inputClassName, labelClassName } from "../types";

export function DetailsStep({ formData, onInputChange, error }: StepProps) {
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

  return (
    <div className="space-y-8 relative">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          Your Details
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Tell us where to deliver your {formData.capacity}L{" "}
          {formData.machineType === "single" ? "Single" : "Double"} Tank Machine
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
            onChange={onInputChange}
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
            onChange={onInputChange}
            className={inputClassName}
            placeholder="ZIP Code"
          />
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
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
    </div>
  );
}
