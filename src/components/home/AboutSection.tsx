import Image from "next/image";

export default function AboutSection() {
  return (
    <div className="bg-light dark:bg-charcoal py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-charcoal dark:text-white mb-6">
              San Antonio&apos;s Premier
              <span className="block text-margarita">Margarita Service</span>
            </h2>
            <div className="space-y-4">
              <p className="text-lg text-charcoal/80 dark:text-white/80">
                Founded by San Antonio natives who understand the heart and soul
                of Tex-Mex culture, SATX Ritas brings the authentic taste of our
                city to your events. We are more than just a margarita machine
                rental service – we are your partners in creating unforgettable
                experiences.
              </p>
              <p className="text-lg text-charcoal/80 dark:text-white/80">
                Our commitment to quality means using only premium ingredients,
                professional-grade equipment, and providing exceptional service
                that keeps our customers coming back event after event.
              </p>
            </div>

            {/* Value Propositions */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-teal/10 dark:bg-teal/20 rounded-lg">
                    <svg
                      className="w-6 h-6 text-teal"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    No Deposit Required
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Reserve your machine with zero money down
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-teal/10 dark:bg-teal/20 rounded-lg">
                    <svg
                      className="w-6 h-6 text-teal"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    No Payment Upfront
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    You only pay on the day of your event
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-teal/10 dark:bg-teal/20 rounded-lg">
                    <svg
                      className="w-6 h-6 text-teal"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    Cancel Anytime
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Plans change — cancel with no penalty
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-teal/10 dark:bg-teal/20 rounded-lg">
                    <svg
                      className="w-6 h-6 text-teal"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    24/7 Support
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    We&apos;re always here when you need us
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-lg h-64 overflow-hidden">
                <Image
                  src="/margarita-frozen-2.jpg"
                  alt="Frozen Margarita"
                  width={400}
                  height={256}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
              <div className="rounded-lg h-64 overflow-hidden">
                <Image
                  src="/pina-colada-1.jpg"
                  alt="Piña Colada"
                  width={400}
                  height={400}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="rounded-lg h-48 overflow-hidden">
                <Image
                  src="/blue-hawaiian-1.jpg"
                  alt="Blue Hawaiian"
                  width={400}
                  height={192}
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="rounded-lg h-64 overflow-hidden">
                <Image
                  src="/straw-daiquiri-1.jpg"
                  alt="Strawberry Daiquiri"
                  width={400}
                  height={256}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
