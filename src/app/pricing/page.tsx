import { machinePackages, mixerDetails } from "@/lib/rental-data";
import { Metadata } from "next";
import Image from "next/image";

// Add JSON-LD structured data for products
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    {
      "@type": "Product",
      name: machinePackages[0].name,
      description: machinePackages[0].description,
      image: "https://satxritas.com/og-image.jpg",
      offers: [
        {
          "@type": "Offer",
          price: machinePackages[0].basePrice,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "Machine Only",
        },
        {
          "@type": "Offer",
          price:
            machinePackages[0].basePrice + mixerDetails["non-alcoholic"].price,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "With Non-Alcoholic Mixer",
        },
        {
          "@type": "Offer",
          price: machinePackages[0].basePrice + mixerDetails["margarita"].price,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "With Premium Mixers",
        },
      ],
    },
    {
      "@type": "Product",
      name: machinePackages[1].name,
      description: machinePackages[1].description,
      image: "https://satxritas.com/og-image.jpg",
      offers: [
        {
          "@type": "Offer",
          price: machinePackages[1].basePrice,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "Machine Only",
        },
        {
          "@type": "Offer",
          price:
            machinePackages[1].basePrice + mixerDetails["non-alcoholic"].price,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "With Non-Alcoholic Mixer",
        },
        {
          "@type": "Offer",
          price: machinePackages[1].basePrice + mixerDetails["margarita"].price,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "With Premium Mixers",
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "Pricing | SATX Ritas Rentals - Frozen Drink Machine Rentals",
  description:
    "Transparent pricing for frozen drink machine rentals in San Antonio. Professional delivery, setup, and pickup included. Single and double tank machines available with various mixer options.",
  alternates: {
    canonical: "https://satxritas.com/pricing",
  },
  other: {
    "script:ld+json": JSON.stringify(jsonLd),
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-16 pt-8">
          <div className="mb-8 inline-block">
            <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
              💎 Premium Service
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
            Transparent
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2 pb-2">
              Pricing & Service
            </span>
          </h1>
          <p className="text-xl text-charcoal/80 dark:text-white/80 max-w-2xl mx-auto px-4">
            All-inclusive pricing with no hidden fees. Every rental includes
            professional delivery, setup, and pickup.
          </p>
        </div>

        {/* Service Details */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">🚚</div>
              <h3 className="text-xl font-bold text-charcoal dark:text-white mb-2">
                Professional Delivery
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                We handle all the heavy lifting. Our team will deliver your
                machine at your preferred time, ensuring it arrives safely and
                ready for setup.
              </p>
            </div>
            <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-xl font-bold text-charcoal dark:text-white mb-2">
                Expert Setup
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                Our technicians will professionally install and configure your
                machine, provide operational training, and ensure everything is
                working perfectly.
              </p>
            </div>
            <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-charcoal dark:text-white mb-2">
                Hassle-free Pickup
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                When your event is over, we will handle the cleanup and pickup.
                No need to worry about cleaning or returning the machine
                yourself.
              </p>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-16">
            <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-8 text-center">
              Understanding Our Pricing
            </h2>
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <div className="relative mb-6">
                  <Image
                    src="/vevor-15l-slushy-3.webp"
                    alt="Single Tank Frozen Drink Machine"
                    width={800}
                    height={600}
                    className="w-full h-full object-cover rounded-lg"
                    priority
                  />
                </div>
                <h3 className="text-2xl font-semibold text-charcoal dark:text-white mb-4">
                  {machinePackages[0].name}
                </h3>
                <p className="text-charcoal/70 dark:text-white/70 mb-6">
                  Perfect for intimate gatherings and smaller events. This
                  single tank system provides up to{" "}
                  {machinePackages[0].capacity}L of frozen beverages.
                </p>
                <div className="space-y-3">
                  <p className="flex justify-between items-center py-2 border-b border-charcoal/10 dark:border-white/10">
                    <span className="text-charcoal dark:text-white">
                      Machine Only
                    </span>
                    <span className="font-semibold text-charcoal dark:text-white">
                      ${machinePackages[0].basePrice}
                    </span>
                  </p>
                  <p className="flex justify-between items-center py-2 border-b border-charcoal/10 dark:border-white/10">
                    <span className="text-charcoal dark:text-white">
                      With Non-Alcoholic Mixer
                    </span>
                    <span className="font-semibold text-charcoal dark:text-white">
                      $
                      {machinePackages[0].basePrice +
                        mixerDetails["non-alcoholic"].price}
                    </span>
                  </p>
                  <p className="flex justify-between items-center py-2 border-b border-charcoal/10 dark:border-white/10">
                    <span className="text-charcoal dark:text-white">
                      With Premium Mixers
                    </span>
                    <span className="font-semibold text-charcoal dark:text-white">
                      $
                      {machinePackages[0].basePrice +
                        mixerDetails["margarita"].price}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <div className="relative mb-6">
                  <Image
                    src="/vevor-30l-slushy-4.webp"
                    alt="Double Tank Frozen Drink Machine"
                    width={800}
                    height={600}
                    className="w-full h-full object-cover rounded-lg"
                    priority
                  />
                </div>
                <h3 className="text-2xl font-semibold text-charcoal dark:text-white mb-4">
                  {machinePackages[1].name}
                </h3>
                <p className="text-charcoal/70 dark:text-white/70 mb-6">
                  Ideal for larger events or when you want to offer multiple
                  flavors. This dual tank system provides up to{" "}
                  {machinePackages[1].capacity}L of frozen beverages.
                </p>
                <div className="space-y-3">
                  <p className="flex justify-between items-center py-2 border-b border-charcoal/10 dark:border-white/10">
                    <span className="text-charcoal dark:text-white">
                      Machine Only
                    </span>
                    <span className="font-semibold text-charcoal dark:text-white">
                      ${machinePackages[1].basePrice}
                    </span>
                  </p>
                  <p className="flex justify-between items-center py-2 border-b border-charcoal/10 dark:border-white/10">
                    <span className="text-charcoal dark:text-white">
                      With Non-Alcoholic Mixer
                    </span>
                    <span className="font-semibold text-charcoal dark:text-white">
                      $
                      {machinePackages[1].basePrice +
                        mixerDetails["non-alcoholic"].price}
                    </span>
                  </p>
                  <p className="flex justify-between items-center py-2 border-b border-charcoal/10 dark:border-white/10">
                    <span className="text-charcoal dark:text-white">
                      With Premium Mixers
                    </span>
                    <span className="font-semibold text-charcoal dark:text-white">
                      $
                      {machinePackages[1].basePrice +
                        mixerDetails["margarita"].price}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="bg-gradient-to-r from-margarita/20 to-teal/20 dark:from-margarita/10 dark:to-teal/10 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-6 text-center">
              Why Our Service Stands Out
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-margarita mr-3 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-charcoal dark:text-white">
                      24/7 Support
                    </h3>
                    <p className="text-charcoal/70 dark:text-white/70">
                      Technical assistance available throughout your rental
                      period
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-margarita mr-3 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-charcoal dark:text-white">
                      Professional Training
                    </h3>
                    <p className="text-charcoal/70 dark:text-white/70">
                      On-site instruction for proper machine operation
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-margarita mr-3 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-charcoal dark:text-white">
                      Quality Equipment
                    </h3>
                    <p className="text-charcoal/70 dark:text-white/70">
                      Commercial-grade machines maintained to the highest
                      standards
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-margarita mr-3 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-charcoal dark:text-white">
                      Sanitized Equipment
                    </h3>
                    <p className="text-charcoal/70 dark:text-white/70">
                      Thoroughly cleaned and sanitized before every rental
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-margarita mr-3 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-charcoal dark:text-white">
                      Flexible Scheduling
                    </h3>
                    <p className="text-charcoal/70 dark:text-white/70">
                      Delivery and pickup times that work with your event
                      schedule
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <svg
                    className="w-6 h-6 text-margarita mr-3 flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-charcoal dark:text-white">
                      No Hidden Fees
                    </h3>
                    <p className="text-charcoal/70 dark:text-white/70">
                      All-inclusive pricing with delivery, setup, and pickup
                      included
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
