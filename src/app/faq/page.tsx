import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Rita's Frozen Drink Machine Rentals",
  description:
    "Find answers to common questions about our frozen drink machine rentals, including delivery, setup, mixers, payment options, and policies in San Antonio.",
  openGraph: {
    title: "FAQ - Rita's Frozen Drink Machine Rentals",
    description:
      "Everything you need to know about renting frozen drink machines in San Antonio, from setup to mixers and policies.",
    type: "website",
  },
};

export default function FAQ() {
  return (
    <div className="relative isolate px-6 pt-14 lg:px-8">
      {/* Decorative blurs */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-margarita to-teal opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl">
        {/* Hero section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-charcoal dark:text-white sm:text-6xl mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-charcoal/80 dark:text-white/80 max-w-2xl mx-auto">
            Everything you need to know about our frozen drink machine rentals
          </p>
        </div>

        {/* FAQ sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          {/* Rental Basics */}
          <section
            aria-labelledby="rental-basics"
            className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8"
          >
            <h2
              id="rental-basics"
              className="text-2xl font-bold text-charcoal dark:text-white mb-6"
            >
              Rental Basics
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  How long is the rental period?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Standard rental period is 24 hours. Extended rental periods
                  are available upon request. We will coordinate pickup timing
                  during your booking.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  Need it longer?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Extended rentals are available upon request. Contact us for
                  special pricing on multi-day rentals.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What if something goes wrong during my event?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  We provide 24/7 support during your rental period. If any
                  issues arise, we will quickly respond to ensure your event
                  continues smoothly.
                </p>
              </div>
            </div>
          </section>

          {/* Drinks & Mixers */}
          <section
            aria-labelledby="drinks-mixers"
            className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8"
          >
            <h2
              id="drinks-mixers"
              className="text-2xl font-bold text-charcoal dark:text-white mb-6"
            >
              Drinks & Mixers
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What about the alcohol?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  You will provide your own alcohol. During setup, we will guide
                  you on the right amount needed for your chosen mixer and
                  provide mixing instructions for the perfect drink consistency.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What mixer options are available?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  We offer premium margarita and piña colada mixes, perfect for
                  adult beverages. For family-friendly events, we also provide
                  Non-Alcoholic options. You can also choose to use your own
                  mixers for complete control over your drinks.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  How many drinks can each machine make?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Our 15L single tank machine serves approximately 100 drinks,
                  while our 30L double tank machine can serve up to 200 drinks.
                  These are estimates based on 5oz servings.
                </p>
              </div>
            </div>
          </section>

          {/* Delivery & Setup */}
          <section
            aria-labelledby="delivery-setup"
            className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8"
          >
            <h2
              id="delivery-setup"
              className="text-2xl font-bold text-charcoal dark:text-white mb-6"
            >
              Delivery & Setup
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  Do you provide delivery?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Yes! We provide delivery, professional setup, and pickup
                  throughout the San Antonio metropolitan area. Our team will
                  handle all the heavy lifting and ensure everything is working
                  perfectly.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What space requirements are needed?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  You will need a flat, stable surface near a power outlet.
                  Single machines require about 2x2 feet of space, while double
                  machines need 3x2 feet. We will help determine the best
                  location during delivery.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  Can the machines be used outdoors?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Yes, but they must be protected from direct sunlight and rain.
                  We recommend placing them under a tent or covered area. They
                  should also be on a stable, level surface.
                </p>
              </div>
            </div>
          </section>

          {/* Payment & Policies */}
          <section
            aria-labelledby="payment-policies"
            className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl"
          >
            <h2
              id="payment-policies"
              className="text-2xl font-bold text-charcoal dark:text-white mb-6"
            >
              Payment & Policies
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  We accept all major credit cards, cash, and digital payments
                  through services like Venmo and Cash App. A deposit is
                  required to secure your reservation.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What is your cancellation policy?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  We understand plans can change. Cancellations made at least 7
                  days before your event receive a full refund. For
                  cancellations within 7 days, we will work with you to
                  reschedule for a better date.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  Do you offer insurance?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Our machines are fully insured, and we handle all maintenance
                  and repairs. You are only responsible for preventing
                  intentional damage or misuse during your rental period.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
