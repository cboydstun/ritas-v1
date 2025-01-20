import { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";

// Add JSON-LD structured data for contact page
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact SATX Rita's Rentals",
  description:
    "Contact page for SATX Rita's Rentals - San Antonio's premium frozen drink machine rental service",
  mainEntity: {
    "@type": "LocalBusiness",
    name: "SATX Rita's Rentals",
    image: "https://satxritas.com/og-image.jpg",
    telephone: "(210) 555-0123",
    email: "info@satxritas.com",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "10:00",
        closes: "16:00",
      },
    ],
    areaServed: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: 29.4241,
        longitude: -98.4936,
      },
      geoRadius: "50000",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "San Antonio",
      addressRegion: "TX",
      addressCountry: "US",
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://satxritas.com/order",
        inLanguage: "en-US",
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: {
        "@type": "Reservation",
        name: "Frozen Drink Machine Rental Reservation",
      },
    },
  },
};

// Add metadata with JSON-LD
export const metadata: Metadata = {
  title: "Contact Us | SATX Rita's Rentals - Frozen Drink Machine Rentals",
  description:
    "Get in touch with SATX Rita's Rentals for premium frozen drink machine rentals in San Antonio. Contact us for bookings, questions, or support. Professional service with flexible scheduling.",
  alternates: {
    canonical: "https://satxritas.com/contact",
  },
  other: {
    "script:ld+json": JSON.stringify(jsonLd),
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative pt-24 pb-16 text-center">
        <div className="mb-8 inline-block">
          <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase">
            📞 Get in Touch
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
          Contact
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
            SATX Ritas
          </span>
        </h1>
        <p className="text-xl text-charcoal/80 dark:text-white/80 max-w-2xl mx-auto px-4">
          Ready to elevate your event with premium frozen drinks? We&apos;re
          here to help make it happen.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
              Send Us a Message
            </h2>
            <ContactForm />
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            {/* Business Hours */}
            <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
                Business Hours
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/80 dark:text-white/80">
                    Monday - Friday
                  </span>
                  <span className="font-semibold text-charcoal dark:text-white">
                    9:00 AM - 6:00 PM
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/80 dark:text-white/80">
                    Saturday
                  </span>
                  <span className="font-semibold text-charcoal dark:text-white">
                    10:00 AM - 4:00 PM
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/80 dark:text-white/80">
                    Sunday
                  </span>
                  <span className="font-semibold text-charcoal dark:text-white">
                    Closed
                  </span>
                </div>
                <p className="text-sm text-charcoal/70 dark:text-white/70 mt-4">
                  * Delivery and pickup times are available outside of business
                  hours by appointment
                </p>
              </div>
            </div>

            {/* Contact Methods */}
            <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
                Get in Touch
              </h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-margarita/20 dark:bg-margarita/10 rounded-lg flex items-center justify-center">
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
                    <h3 className="text-lg font-semibold text-charcoal dark:text-white">
                      Phone
                    </h3>
                    <p className="text-charcoal/80 dark:text-white/80">
                      (210) 555-0123
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-margarita/20 dark:bg-margarita/10 rounded-lg flex items-center justify-center">
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
                    <h3 className="text-lg font-semibold text-charcoal dark:text-white">
                      Email
                    </h3>
                    <p className="text-charcoal/80 dark:text-white/80">
                      info@satxritas.com
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Area */}
            <div className="bg-gradient-to-r from-margarita/20 to-teal/20 dark:from-margarita/10 dark:to-teal/10 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-4">
                Service Area
              </h2>
              <p className="text-charcoal/80 dark:text-white/80 mb-4">
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
                  <span className="text-charcoal/80 dark:text-white/80">
                    Downtown
                  </span>
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
                  <span className="text-charcoal/80 dark:text-white/80">
                    Alamo Heights
                  </span>
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
                  <span className="text-charcoal/80 dark:text-white/80">
                    Stone Oak
                  </span>
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
                  <span className="text-charcoal/80 dark:text-white/80">
                    Hollywood Park
                  </span>
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
                  <span className="text-charcoal/80 dark:text-white/80">
                    Converse
                  </span>
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
                  <span className="text-charcoal/80 dark:text-white/80">
                    Shavano Park
                  </span>
                </div>
              </div>
              <p className="text-sm text-charcoal/70 dark:text-white/70 mt-4">
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
