import { machinePackages, mixerDetails } from "@/lib/rental-data";
import { calculatePrice, formatPrice } from "@/lib/pricing";
import { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
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
          price: calculatePrice("single").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "Machine Only",
        },
        {
          "@type": "Offer",
          price: calculatePrice("single", "non-alcoholic").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: mixerDetails["non-alcoholic"].label,
        },
        {
          "@type": "Offer",
          price: calculatePrice("single", "margarita").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: mixerDetails["margarita"].label,
        },
        {
          "@type": "Offer",
          price: calculatePrice("single", "pina-colada").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: mixerDetails["pina-colada"].label,
        },
        {
          "@type": "Offer",
          price: calculatePrice("single", "strawberry-daiquiri").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: mixerDetails["strawberry-daiquiri"].label,
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
          price: calculatePrice("double").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "Machine Only",
        },
        {
          "@type": "Offer",
          price: calculatePrice("double", "non-alcoholic").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `2x ${mixerDetails["non-alcoholic"].label}`,
        },
        {
          "@type": "Offer",
          price: calculatePrice("double", "margarita").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `2x ${mixerDetails["margarita"].label}`,
        },
        {
          "@type": "Offer",
          price: calculatePrice("double", "pina-colada").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `2x ${mixerDetails["pina-colada"].label}`,
        },
        {
          "@type": "Offer",
          price: calculatePrice("double", "strawberry-daiquiri").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `2x ${mixerDetails["strawberry-daiquiri"].label}`,
        },
      ],
    },
    {
      "@type": "Product",
      name: machinePackages[2].name,
      description: machinePackages[2].description,
      image: "https://satxritas.com/og-image.jpg",
      offers: [
        {
          "@type": "Offer",
          price: calculatePrice("triple").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: "Machine Only",
        },
        {
          "@type": "Offer",
          price: calculatePrice("triple", "non-alcoholic").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `3x ${mixerDetails["non-alcoholic"].label}`,
        },
        {
          "@type": "Offer",
          price: calculatePrice("triple", "margarita").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `3x ${mixerDetails["margarita"].label}`,
        },
        {
          "@type": "Offer",
          price: calculatePrice("triple", "pina-colada").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `3x ${mixerDetails["pina-colada"].label}`,
        },
        {
          "@type": "Offer",
          price: calculatePrice("triple", "strawberry-daiquiri").total,
          priceCurrency: "USD",
          itemCondition: "https://schema.org/NewCondition",
          availability: "https://schema.org/InStock",
          name: `3x ${mixerDetails["strawberry-daiquiri"].label}`,
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "Pricing | SATX Ritas Rentals - Frozen Drink Machine Rentals",
  description:
    "Transparent pricing for frozen drink machine rentals in San Antonio. Professional delivery, setup, and pickup included. Single, double, and triple tank machines available with various mixer options.",
};

export default function PricingPage() {
  return (
    <>
      <Script
        id="pricing-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
        {/* Decorative Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
        </div>

        {/* Header */}
        <div className="mx-auto max-w-7xl">
          <div className="text-center pt-8">
            <div className="mb-4 inline-block">
              <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
                💎 Premium Service
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-2 tracking-tight">
              Transparent
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2 pb-2">
                Pricing & Service
              </span>
            </h1>
          </div>

          {/* Service Details */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
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
                  machine, provide operational training, and ensure everything
                  is working perfectly.
                </p>
              </div>
              <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="text-xl font-bold text-charcoal dark:text-white mb-2">
                  Hassle-free Pickup
                </h3>
                <p className="text-charcoal/70 dark:text-white/70">
                  When your event is over, we will handle the cleanup and
                  pickup. No need to worry about cleaning or returning the
                  machine yourself.
                </p>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-16">
              <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-8 text-center">
                Understanding Our Pricing
              </h2>
              <div className="max-w-3xl mx-auto">
                <div className="grid grid-cols-3 gap-8 mb-8">
                  <div className="relative">
                    <Image
                      src="/vevor-15l-slushy-3.webp"
                      alt="Single Tank Frozen Drink Machine"
                      width={800}
                      height={600}
                      className="w-full h-full object-cover rounded-lg"
                      priority
                    />
                  </div>
                  <div className="relative">
                    <Image
                      src="/vevor-30l-slushy-4.webp"
                      alt="Double Tank Frozen Drink Machine"
                      width={800}
                      height={600}
                      className="w-full h-full object-cover rounded-lg"
                      priority
                    />
                  </div>
                  <div className="relative">
                    <Image
                      src="/vevor-45l-slushy-1.webp"
                      alt="Triple Tank Frozen Drink Machine"
                      width={800}
                      height={600}
                      className="w-full h-full object-cover rounded-lg"
                      priority
                    />
                  </div>
                </div>

                <div className="text-charcoal/70 dark:text-white/70">
                  <h4 className="text-lg font-semibold text-charcoal dark:text-white mb-4">
                    Machine Options
                  </h4>
                  <div className="grid grid-cols-3 gap-8 mb-8">
                    <div>
                      <p className="font-medium text-charcoal dark:text-white mb-2">
                        15L Single Tank Machine
                      </p>
                      <p className="mb-2">
                        Perfect for intimate gatherings and smaller events.
                      </p>
                      <p className="font-semibold">
                        Base Price: ${formatPrice(machinePackages[0].basePrice)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-charcoal dark:text-white mb-2">
                        30L Double Tank Machine
                      </p>
                      <p className="mb-2">
                        Ideal for larger events. Each tank can hold a different
                        flavor.
                      </p>
                      <p className="font-semibold">
                        Base Price: ${formatPrice(machinePackages[1].basePrice)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-charcoal dark:text-white mb-2">
                        45L Triple Tank Machine
                      </p>
                      <p className="mb-2">
                        The ultimate machine for large events and variety. Three
                        different flavors.
                      </p>
                      <p className="font-semibold">
                        Base Price: ${formatPrice(machinePackages[2].basePrice)}
                      </p>
                    </div>
                  </div>

                  <h4 className="text-lg font-semibold text-charcoal dark:text-white mb-4">
                    Mixer Options
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                      <p>
                        <span className="font-medium">Non-Alcoholic:</span> $
                        {formatPrice(mixerDetails["non-alcoholic"].price)}
                      </p>
                      <p>
                        <span className="font-medium">Margarita:</span> $
                        {formatPrice(mixerDetails["margarita"].price)}
                      </p>
                    </div>
                    <div>
                      <p>
                        <span className="font-medium">Piña Colada:</span> $
                        {formatPrice(mixerDetails["pina-colada"].price)}
                      </p>
                      <p>
                        <span className="font-medium">
                          Strawberry Daiquiri:
                        </span>{" "}
                        $
                        {formatPrice(mixerDetails["strawberry-daiquiri"].price)}
                      </p>
                    </div>
                  </div>

                  <h4 className="text-lg font-semibold text-charcoal dark:text-white mb-4">
                    Fees
                  </h4>
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <p>
                      <span className="font-medium">Delivery:</span>
                      <br />
                      $20.00
                    </p>
                    <p>
                      <span className="font-medium">Sales Tax:</span>
                      <br />
                      8.25%
                    </p>
                    <p>
                      <span className="font-medium">Processing:</span>
                      <br />
                      3%
                    </p>
                  </div>

                  <div className="text-center mt-8">
                    <Link
                      href="/order"
                      className="inline-block px-8 py-4 bg-margarita hover:bg-margarita/90 text-white font-semibold rounded-lg transition-colors text-lg"
                    >
                      Start Your Order
                    </Link>
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
              <div className="text-center mt-8">
                <Link
                  href="/about"
                  className="inline-block px-8 py-4 bg-margarita hover:bg-margarita/90 text-white font-semibold rounded-lg transition-colors text-lg"
                >
                  About Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
