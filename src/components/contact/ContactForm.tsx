"use client";
import { useState } from "react";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    message: "",
  });
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
      const response = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: "Thank you! Your message has been sent successfully.",
        });
        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          eventDate: "",
          message: "",
        });
      } else {
        setSubmitStatus({
          type: "error",
          message:
            data.message || "Failed to submit the form. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error submitting contact form:", error);
      setSubmitStatus({
        type: "error",
        message: "Failed to submit the form. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
      <div>
        <label htmlFor="name" className={labelClassName}>
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
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
          placeholder="your@email.com"
        />
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
        <label htmlFor="eventDate" className={labelClassName}>
          Event Date
        </label>
        <input
          type="date"
          id="eventDate"
          name="eventDate"
          value={formData.eventDate}
          onChange={handleChange}
          required
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="message" className={labelClassName}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={4}
          className={inputClassName}
          placeholder="Tell us about your event..."
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full px-6 py-3 bg-gradient-to-r from-margarita to-teal text-white rounded-lg hover:shadow-lg hover:shadow-margarita/30 transform hover:-translate-y-1 transition-all duration-300 font-semibold ${
          isSubmitting ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {isSubmitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
