import OrderForm from "@/components/order/OrderForm";
import { Suspense } from "react";
import { Metadata } from "next";

// Add JSON-LD structured data for service booking
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Frozen Drink Machine Rental Booking",
  provider: {
    "@type": "LocalBusiness",
    name: "SATX Rita's Rentals",
    image: "https://satxritas.com/og-image.jpg",
    address: {
      "@type": "PostalAddress",
      addressLocality: "San Antonio",
      addressRegion: "TX",
      addressCountry: "US",
    },
    areaServed: {
      "@type": "City",
      name: "San Antonio",
    },
  },
  description:
    "Professional frozen drink machine rental service including delivery, setup, and pickup. Available for parties, weddings, corporate events, and more.",
  serviceType: "Equipment Rental",
  termsOfService: "24-hour standard rental period with flexible scheduling",
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    areaServed: {
      "@type": "City",
      name: "San Antonio",
    },
  },
};

export const metadata: Metadata = {
  title: "Book Now | SATX Rita's Rentals - Frozen Drink Machine Rentals",
  description:
    "Book your frozen drink machine rental in San Antonio. Easy online booking with flexible scheduling, delivery, and setup included. Perfect for parties and events of any size.",
  alternates: {
    canonical: "https://satxritas.com/order",
  },
  other: {
    "script:ld+json": JSON.stringify(jsonLd),
  },
};

export default function OrderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10 py-12 relative">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="mb-8 inline-block">
            <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
              🎉 Lets Get Started
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
            Book Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
              Margarita Service
            </span>
          </h1>
          <p className="text-xl text-charcoal/70 dark:text-white/70 max-w-2xl mx-auto">
            Fill out the form below to start your booking process. We will help
            you create the perfect frozen drink experience for your event.
          </p>
        </div>
        <Suspense fallback={<div className="text-center">Loading form...</div>}>
          <OrderForm />
        </Suspense>
      </div>
    </div>
  );
}
