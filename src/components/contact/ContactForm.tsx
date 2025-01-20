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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic would go here
    console.log("Form submitted:", formData);
    // Reset form
    setFormData({
      name: "",
      email: "",
      phone: "",
      eventDate: "",
      message: "",
    });
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
        className="w-full px-6 py-3 bg-gradient-to-r from-margarita to-teal text-white rounded-lg hover:shadow-lg hover:shadow-margarita/30 transform hover:-translate-y-1 transition-all duration-300 font-semibold"
      >
        Send Message
      </button>
    </form>
  );
}
