import { Metadata } from "next";

// Add JSON-LD structured data for Article
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "About SATX Ritas Rentals - San Antonio's Premium Frozen Drink Machine Rental Service",
  description:
    "Learn about SATX Ritas Rentals, our story, values, and commitment to creating unforgettable events in San Antonio with premium frozen drink machines.",
  image: "https://satxritas.com/og-image.jpg",
  datePublished: "2024-01-01T00:00:00+00:00",
  dateModified: new Date().toISOString(),
  author: {
    "@type": "Organization",
    name: "SATX Ritas Rentals",
    url: "https://satxritas.com",
  },
  publisher: {
    "@type": "Organization",
    name: "SATX Ritas Rentals",
    logo: {
      "@type": "ImageObject",
      url: "https://satxritas.com/og-image.jpg",
    },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://satxritas.com/about",
  },
};

export const metadata: Metadata = {
  title: "About SATX Ritas Rentals | Our Story & Values",
  description:
    "Learn about SATX Ritas Rentals, San Antonio's trusted source for premium frozen drink machine rentals. Discover our story, values, and commitment to creating unforgettable events with quality service.",
  alternates: {
    canonical: "https://satxritas.com/about",
  },
  other: {
    "script:ld+json": JSON.stringify(jsonLd),
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
      </div>

      {/* Our Story Section */}
      <div className="relative pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="mb-8 inline-block">
              <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
                👋 Hello!
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
              Our
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
                Story
              </span>
            </h1>
            <div className="max-w-3xl mx-auto">
              <p className="text-xl text-charcoal/80 dark:text-white/80 mb-6">
                We started SATX Ritas with a passion for creating unforgettable
                moments at San Antonio events through premium frozen drink
                experiences.
              </p>
              <p className="text-xl text-charcoal/80 dark:text-white/80 mb-6">
                What began as a vision to elevate local celebrations has grown
                into San Antonio&apos;s trusted source for professional-grade
                frozen drink machine rentals.
              </p>
              <p className="text-xl text-charcoal/80 dark:text-white/80">
                From backyard gatherings to corporate events, we&apos;ve become
                known for our commitment to quality equipment, exceptional
                service, and the perfect frozen drinks that bring people
                together.
              </p>
            </div>
          </div>

          {/* Why Choose Us Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-24">
            <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold text-charcoal dark:text-white mb-3">
                Quality First
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                Commercial-grade machines maintained to the highest standards,
                ensuring consistent, restaurant-quality frozen drinks every
                time.
              </p>
            </div>
            <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-bold text-charcoal dark:text-white mb-3">
                Dependable Service
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                Precise delivery and professional setup, with expert training to
                ensure your event runs smoothly from start to finish.
              </p>
            </div>
            <div className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-bold text-charcoal dark:text-white mb-3">
                Premium Support
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                24/7 technical assistance throughout your rental period, because
                we know great service doesn&apos;t end with delivery.
              </p>
            </div>
          </div>

          {/* Our Values */}
          <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-12 shadow-xl mb-24">
            <h2 className="text-4xl font-bold text-charcoal dark:text-white mb-12 text-center">
              Our Values
            </h2>
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold text-charcoal dark:text-white mb-4">
                    Excellence in Service
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Every rental experience is an opportunity to exceed
                    expectations. From our premium machines to our white-glove
                    service, we ensure every detail is perfect.
                  </p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-charcoal dark:text-white mb-4">
                    Reliability
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    When you book with SATX Ritas, you can trust that your
                    machine will arrive on time, work perfectly, and create the
                    exact frozen drinks you envisioned.
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold text-charcoal dark:text-white mb-4">
                    Local Commitment
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    As a San Antonio-based business, we take pride in serving
                    our community and being part of the celebrations that make
                    our city special.
                  </p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-charcoal dark:text-white mb-4">
                    Customer Success
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Your event&apos;s success is our success. We provide
                    comprehensive support and guidance to ensure your frozen
                    drinks are a hit with your guests.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Area */}
          <div className="bg-gradient-to-r from-margarita/20 to-teal/20 dark:from-margarita/10 dark:to-teal/10 rounded-2xl p-12 shadow-xl">
            <h2 className="text-4xl font-bold text-charcoal dark:text-white mb-8 text-center">
              Serving San Antonio
            </h2>
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xl text-charcoal/80 dark:text-white/80 mb-6">
                We proudly serve the entire San Antonio metropolitan area,
                bringing premium frozen drink experiences to events throughout
                the region.
              </p>
              <p className="text-xl text-charcoal/80 dark:text-white/80">
                From the heart of downtown to the growing suburbs, our team
                ensures your celebration has the perfect frozen drinks,
                professionally served with the authentic flavor of San Antonio
                hospitality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
