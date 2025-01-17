export default function FAQPage() {
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
            ❓ Got Questions?
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
          Frequently Asked
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
            Questions
          </span>
        </h1>
        <p className="text-xl text-charcoal/80 dark:text-white/80 max-w-2xl mx-auto px-4">
          Everything you need to know about our frozen drink machine rentals
        </p>
      </div>

      {/* FAQ Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Rental Basics */}
        <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
            Rental Basics
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                How long can I rent the machine?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                Our standard rental period is 24 hours, perfect for most events.
                Need it longer? Extended rental periods are available upon
                request - just let us know your needs when booking.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                What&apos;s included in the rental?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                Your rental includes professional delivery, setup, operational
                training, and pickup. We also provide all necessary supplies
                except for the alcohol. Each machine comes thoroughly cleaned
                and sanitized, ready for your event.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                How far in advance should I book?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                We recommend booking at least 2-3 weeks in advance, especially
                for weekend events or peak seasons. However, we will always try
                our best to accommodate last-minute requests when possible.
              </p>
            </div>
          </div>
        </div>

        {/* Machine Operation */}
        <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
            Machine Operation
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                How do the machines work?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                Our machines are commercial-grade frozen drink makers that
                maintain the perfect slushy consistency. They are fully
                automatic - once set up, they will keep your drinks at the ideal
                temperature and consistency throughout your event.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                Do I need special electrical requirements?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                Our machines operate on standard 110V household power. You will
                just need a dedicated electrical outlet within 6 feet of where
                you would like the machine placed.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                What if something goes wrong during my event?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                We provide 24/7 technical support throughout your rental period.
                If any issues arise, we are just a phone call away and can walk
                you through solutions or send a technician if needed.
              </p>
            </div>
          </div>
        </div>

        {/* Drinks & Mixers */}
        <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
            Drinks & Mixers
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                What about the alcohol?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                You will need to provide your own alcohol. During setup, we will
                guide you on the right amount needed for your chosen mixer and
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
                Kool-Aid options. You can also choose to use your own mixers for
                complete control over your drinks.
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
        </div>

        {/* Delivery & Setup */}
        <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
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
                You will need a flat, stable surface near a power outlet. Single
                machines require about 2x2 feet of space, while double machines
                need 3x2 feet. We will help determine the best location during
                delivery.
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
        </div>

        {/* Payment & Policies */}
        <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
            Payment & Policies
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                We accept all major credit cards, cash, and digital payments
                through services like Venmo and Cash App. A deposit is required
                to secure your reservation.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                What is your cancellation policy?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                We understand plans can change. Cancellations made at least 7
                days before your event receive a full refund. For cancellations
                within 7 days, we will work with you to reschedule for a better
                date.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                Do you offer insurance?
              </h3>
              <p className="text-charcoal/80 dark:text-white/80">
                Our machines are fully insured, and we handle all maintenance
                and repairs. You are only responsible for preventing intentional
                damage or misuse during your rental period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
