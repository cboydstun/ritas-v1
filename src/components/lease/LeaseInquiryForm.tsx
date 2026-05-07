"use client";
import { useState } from "react";
import {
  LEASE_BUSINESS_TYPES,
  LEASE_TERMS,
  type LeaseBusinessType,
  type LeaseTerm,
  type LeaseTier,
  type LeaseTierId,
} from "@/lib/lease-data";

interface FormState {
  businessName: string;
  businessType: LeaseBusinessType | "";
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  preferredTerm: LeaseTerm | "";
  machinesOfInterest: LeaseTierId[];
  message: string;
}

const initialState: FormState = {
  businessName: "",
  businessType: "",
  contactName: "",
  email: "",
  phone: "",
  address: { street: "", city: "", state: "", zip: "" },
  preferredTerm: "",
  machinesOfInterest: [],
  message: "",
};

interface LeaseInquiryFormProps {
  tiers: LeaseTier[];
}

export default function LeaseInquiryForm({ tiers }: LeaseInquiryFormProps) {
  const [formData, setFormData] = useState<FormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string | null;
  }>({ type: null, message: null });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: null });

    try {
      const response = await fetch("/api/v1/lease-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message:
            "Thank you! Your lease inquiry was sent. Our team will be in touch shortly.",
        });
        setFormData(initialState);
      } else {
        setSubmitStatus({
          type: "error",
          message:
            data.message || "Failed to submit the form. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error submitting lease inquiry:", error);
      setSubmitStatus({
        type: "error",
        message: "Failed to submit the form. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (name.startsWith("address.")) {
      const key = name.split(".")[1] as keyof FormState["address"];
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMachine = (id: LeaseTierId) => {
    setFormData((prev) => ({
      ...prev,
      machinesOfInterest: prev.machinesOfInterest.includes(id)
        ? prev.machinesOfInterest.filter((m) => m !== id)
        : [...prev.machinesOfInterest, id],
    }));
  };

  const inputClassName =
    "w-full px-4 py-2 bg-white dark:bg-white text-charcoal rounded-lg border border-gray-300 focus:ring-2 focus:ring-margarita focus:border-transparent outline-none transition-all";
  const labelClassName =
    "block text-sm font-medium text-charcoal dark:text-white mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitStatus.type && (
        <div
          className={`p-4 mb-6 rounded-lg ${
            submitStatus.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400"
          }`}
        >
          {submitStatus.message}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="businessName" className={labelClassName}>
            Business Name
          </label>
          <input
            type="text"
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            required
            className={inputClassName}
            placeholder="Casa Cantina"
          />
        </div>
        <div>
          <label htmlFor="businessType" className={labelClassName}>
            Business Type
          </label>
          <select
            id="businessType"
            name="businessType"
            value={formData.businessType}
            onChange={handleChange}
            required
            className={inputClassName}
          >
            <option value="" disabled>
              Select a type
            </option>
            {LEASE_BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contactName" className={labelClassName}>
            Contact Name
          </label>
          <input
            type="text"
            id="contactName"
            name="contactName"
            value={formData.contactName}
            onChange={handleChange}
            required
            className={inputClassName}
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClassName}>
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className={inputClassName}
            placeholder="you@business.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className={labelClassName}>
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          className={inputClassName}
          placeholder="(210) 555-0123"
        />
      </div>

      <div>
        <label htmlFor="address.street" className={labelClassName}>
          Business Address
        </label>
        <input
          type="text"
          id="address.street"
          name="address.street"
          value={formData.address.street}
          onChange={handleChange}
          required
          className={inputClassName}
          placeholder="Street address"
        />
        <div className="grid sm:grid-cols-3 gap-4 mt-3">
          <input
            type="text"
            aria-label="City"
            name="address.city"
            value={formData.address.city}
            onChange={handleChange}
            required
            className={inputClassName}
            placeholder="City"
          />
          <input
            type="text"
            aria-label="State"
            name="address.state"
            value={formData.address.state}
            onChange={handleChange}
            required
            className={inputClassName}
            placeholder="State"
          />
          <input
            type="text"
            aria-label="ZIP code"
            name="address.zip"
            value={formData.address.zip}
            onChange={handleChange}
            required
            pattern="\d{5}(-\d{4})?"
            className={inputClassName}
            placeholder="ZIP"
          />
        </div>
      </div>

      <div>
        <label htmlFor="preferredTerm" className={labelClassName}>
          Preferred Lease Term
        </label>
        <select
          id="preferredTerm"
          name="preferredTerm"
          value={formData.preferredTerm}
          onChange={handleChange}
          required
          className={inputClassName}
        >
          <option value="" disabled>
            Select a term
          </option>
          {LEASE_TERMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClassName}>Machines of Interest</legend>
        <div className="grid sm:grid-cols-3 gap-3">
          {tiers.map((tier) => {
            const checked = formData.machinesOfInterest.includes(tier.id);
            return (
              <label
                key={tier.id}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  checked
                    ? "bg-margarita/10 dark:bg-margarita/20 border-margarita text-charcoal dark:text-white"
                    : "bg-white dark:bg-charcoal/30 border-gray-300 dark:border-gray-700 text-charcoal dark:text-white hover:border-margarita"
                }`}
              >
                <input
                  type="checkbox"
                  name="machinesOfInterest"
                  value={tier.id}
                  checked={checked}
                  onChange={() => toggleMachine(tier.id)}
                  className="accent-margarita"
                />
                <span className="text-sm font-medium">{tier.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="message" className={labelClassName}>
          Message <span className="text-charcoal/50">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={4}
          className={inputClassName}
          placeholder="Tell us about your venue, expected volume, timeline, and any questions you have."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full px-6 py-3 bg-gradient-to-r from-margarita to-teal text-white rounded-lg hover:shadow-lg hover:shadow-margarita/30 transform hover:-translate-y-1 transition-all duration-300 font-semibold ${
          isSubmitting ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {isSubmitting ? "Sending..." : "Send Lease Inquiry"}
      </button>
    </form>
  );
}
