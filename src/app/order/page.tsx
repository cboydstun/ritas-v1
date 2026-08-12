import OrderForm from "@/components/order/OrderForm";
import { Suspense } from "react";
import { Metadata } from "next";
import { machinePackages } from "@/lib/rental-data";
import { calculatePrice } from "@/lib/pricing";
import { BUSINESS_ID, SITE_URL } from "@/lib/site";

const round = (value: number) => Number(value.toFixed(2));

// Cheapest bookable configuration (single tank, no mixer) through the most
// expensive one (triple tank, three premium mixers).
const lowPrice = round(calculatePrice("single").total);
const highPrice = round(
  calculatePrice("triple", ["pina-colada", "pina-colada", "pina-colada"]).total,
);

const PAGE_TITLE =
  "Book Now | SATX Ritas Rentals - Frozen Drink Machine Rentals";
const PAGE_DESCRIPTION =
  "Book your frozen drink machine rental in San Antonio. Easy online booking with flexible scheduling, delivery, and setup included. Perfect for parties and events of any size.";

// JSON-LD structured data for service booking.
// Prices are baked in at build time from rental-data.ts and do not reflect
// admin Settings.machines[*].basePrice overrides; priceValidUntil bounds how
// long a stale figure can be trusted. Likewise `availability` is declared once
// at the aggregate level — live per-machine-type inventory (see
// src/lib/inventory.ts) can't be expressed on a statically generated page.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Frozen Drink Machine Rental Booking",
  provider: {
    "@type": "LocalBusiness",
    "@id": BUSINESS_ID,
    name: "SATX Ritas Rentals",
    url: SITE_URL,
    image: `${SITE_URL}/og-image.jpg`,
    telephone: "+1-512-210-0194",
    email: "satxbounce@gmail.com",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "5106 Stormy Autumn",
      addressLocality: "San Antonio",
      addressRegion: "TX",
      postalCode: "78247",
      addressCountry: "US",
    },
  },
  description:
    "Professional frozen drink machine rental service including delivery, setup, and pickup. Available for parties, weddings, corporate events, and more.",
  serviceType: "Equipment Rental",
  termsOfService:
    "Machine and mixer rates are charged per day for the length of the rental, with a flat one-time delivery fee. Multi-day rentals and flexible delivery and pickup scheduling are available.",
  areaServed: {
    "@type": "City",
    name: "San Antonio",
  },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice,
    highPrice,
    offerCount: machinePackages.length,
    availability: "https://schema.org/InStock",
    priceValidUntil: `${new Date().getFullYear()}-12-31`,
  },
};

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/order",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/order",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SATX Ritas Rentals - Book a frozen drink machine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
};

export default function OrderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-linear-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10 py-12 relative">
        {/* Decorative Elements */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse motion-reduce:animate-none" />
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse motion-reduce:animate-none" />
          <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse motion-reduce:animate-none" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="mb-8 inline-block">
              <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce motion-reduce:animate-none">
                🎉 Let&apos;s Get Started
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
              Book Your
              <span className="block text-transparent bg-clip-text bg-linear-to-r from-margarita via-teal to-orange mt-2">
                Margarita Service
              </span>
            </h1>
            <p className="text-xl text-charcoal/70 dark:text-white/70 max-w-2xl mx-auto">
              Fill out the form below to start your booking process. We will
              help you create the perfect frozen drink experience for your
              event.
            </p>
          </div>
          <Suspense fallback={<OrderFormSkeleton />}>
            <OrderForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}

// Reserves roughly the height of the wizard so the fallback → form swap does
// not shift layout on the primary conversion page.
function OrderFormSkeleton() {
  return (
    <div
      className="min-h-[600px] rounded-2xl bg-white/80 dark:bg-charcoal/50 backdrop-blur-xs shadow-xl p-8 animate-pulse motion-reduce:animate-none"
      role="status"
      aria-label="Loading booking form"
    >
      <div className="h-4 w-1/3 rounded-sm bg-charcoal/10 dark:bg-white/10 mb-8" />
      <div className="h-12 rounded-sm bg-charcoal/10 dark:bg-white/10 mb-6" />
      <div className="h-12 rounded-sm bg-charcoal/10 dark:bg-white/10 mb-6" />
      <div className="h-12 w-2/3 rounded-sm bg-charcoal/10 dark:bg-white/10 mb-10" />
      <div className="h-12 w-40 rounded-sm bg-charcoal/10 dark:bg-white/10" />
      <span className="sr-only">Loading form...</span>
    </div>
  );
}
