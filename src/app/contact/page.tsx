"use client";
import { useState } from "react";

export default function ContactPage() {
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 rounded-full blur-xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative pt-24 pb-16 text-center">
        <div className="mb-8 inline-block">
          <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 text-charcoal text-sm font-semibold tracking-wide uppercase">
            📞 Get in Touch
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal mb-6 tracking-tight">
          Contact
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
            SATX Ritas
          </span>
        </h1>
        <p className="text-xl text-charcoal/80 max-w-2xl mx-auto px-4">
          Ready to elevate your event with premium frozen drinks? We&apos;re
          here to help make it happen.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-charcoal mb-6">
              Send Us a Message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-charcoal mb-1"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-margarita focus:border-transparent outline-none transition-all"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-charcoal mb-1"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-margarita focus:border-transparent outline-none transition-all"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-charcoal mb-1"
                >
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-margarita focus:border-transparent outline-none transition-all"
                  placeholder="(210) 555-0123"
                />
              </div>
              <div>
                <label
                  htmlFor="eventDate"
                  className="block text-sm font-medium text-charcoal mb-1"
                >
                  Event Date
                </label>
                <input
                  type="date"
                  id="eventDate"
                  name="eventDate"
                  value={formData.eventDate}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-margarita focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-charcoal mb-1"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-margarita focus:border-transparent outline-none transition-all"
                  placeholder="Tell us about your event..."
                />
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-margarita text-white rounded-lg hover:bg-teal transition-colors font-semibold"
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            {/* Business Hours */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-charcoal mb-6">
                Business Hours
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/80">Monday - Friday</span>
                  <span className="font-semibold text-charcoal">
                    9:00 AM - 6:00 PM
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/80">Saturday</span>
                  <span className="font-semibold text-charcoal">
                    10:00 AM - 4:00 PM
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/80">Sunday</span>
                  <span className="font-semibold text-charcoal">Closed</span>
                </div>
                <p className="text-sm text-charcoal/70 mt-4">
                  * Delivery and pickup times are available outside of business
                  hours by appointment
                </p>
              </div>
            </div>

            {/* Contact Methods */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-charcoal mb-6">
                Get in Touch
              </h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-margarita/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-margarita"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-charcoal">
                      Phone
                    </h3>
                    <p className="text-charcoal/80">(210) 555-0123</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-margarita/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-margarita"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-charcoal">
                      Email
                    </h3>
                    <p className="text-charcoal/80">info@satxritas.com</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Area */}
            <div className="bg-gradient-to-r from-margarita/20 to-teal/20 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-charcoal mb-4">
                Service Area
              </h2>
              <p className="text-charcoal/80 mb-4">
                We proudly serve the entire San Antonio metropolitan area,
                including:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-margarita mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-charcoal/80">Downtown</span>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-margarita mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-charcoal/80">Alamo Heights</span>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-margarita mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-charcoal/80">Stone Oak</span>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-margarita mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-charcoal/80">Schertz</span>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-margarita mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-charcoal/80">New Braunfels</span>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-margarita mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-charcoal/80">Boerne</span>
                </div>
              </div>
              <p className="text-sm text-charcoal/70 mt-4">
                * Additional travel fees may apply for locations outside of Loop
                1604
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
