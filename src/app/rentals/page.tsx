import Link from "next/link";
import { mixerDetails, machinePackages } from "@/lib/rental-data";

export default function RentalsPage() {
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
          <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
            🍹 Choose Your Machine
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
          Frozen Drink
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
            Machine Rentals
          </span>
        </h1>
        <p className="text-xl text-charcoal/80 dark:text-white/80 max-w-2xl mx-auto px-4">
          Professional frozen drink machines for any occasion. Choose your size
          and mixer type below.
        </p>
      </div>

      {/* Machines Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-2 gap-8">
          {machinePackages.map((machine) => (
            <div
              key={machine.type}
              className="relative bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
                  {machine.name}
                </h3>
                <p className="text-charcoal/70 dark:text-white/70 mb-6">
                  {machine.description}
                </p>

                {/* Mixer Options */}
                <div className="space-y-4 mb-8">
                  <h4 className="text-lg font-semibold text-charcoal dark:text-white">
                    Mixer Options:
                  </h4>
                  {machine.mixerOptions.map((option) => (
                    <div
                      key={option.type}
                      className="flex items-center justify-between p-4 rounded-lg bg-light dark:bg-charcoal/30 hover:bg-margarita/10 dark:hover:bg-margarita/5 transition-colors"
                    >
                      <div>
                        <h5 className="font-semibold text-charcoal dark:text-white">
                          {mixerDetails[option.type].label}
                        </h5>
                        <p className="text-sm text-charcoal/70 dark:text-white/70">
                          {mixerDetails[option.type].description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-charcoal dark:text-white">
                          ${option.price}
                        </p>
                        <Link
                          href={`/order?machine=${machine.type}&mixer=${option.type}`}
                          className="inline-block mt-2 px-4 py-2 bg-gradient-to-r from-teal to-margarita text-white text-sm font-semibold rounded-lg
                            hover:shadow-lg hover:shadow-teal/30 transform hover:-translate-y-1 transition-all duration-300"
                        >
                          Select
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-lg font-semibold text-charcoal dark:text-white mb-4">
                    Machine Features:
                  </h4>
                  <ul className="grid grid-cols-2 gap-3">
                    {machine.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center text-charcoal/80 dark:text-white/80"
                      >
                        <svg
                          className="w-5 h-5 text-margarita mr-2 flex-shrink-0"
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
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="relative bg-white/80 dark:bg-charcoal/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h2 className="text-4xl font-bold text-charcoal dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  How long can I rent the machine?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Our standard rental period is 24 hours. Extended rentals are
                  available upon request.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  Do you provide delivery?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Yes! We offer delivery, setup, and pickup services throughout
                  the San Antonio area.
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  What about alcohol?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  You'll need to provide your own alcohol. We'll guide you on
                  the right amount needed for your chosen mixer.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
                  How do I make a reservation?
                </h3>
                <p className="text-charcoal/80 dark:text-white/80">
                  Simply select your preferred machine and mixer option above,
                  then complete the booking form. We'll confirm availability for
                  your chosen date.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
