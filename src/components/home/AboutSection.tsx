export default function AboutSection() {
  return (
    <div className="bg-light dark:bg-charcoal py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-charcoal dark:text-white mb-6">
              San Antonio `&apos;`s Premier
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    Premium Ingredients
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Top-shelf liquors and fresh ingredients
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
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    Reliable Service
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    On-time setup and professional staff
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
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    Local Business
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Proudly serving San Antonio
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
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal dark:text-white">
                    Competitive Pricing
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    Transparent, all-inclusive rates
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-orange/20 dark:bg-orange/10 rounded-lg h-64"></div>
              <div className="bg-teal/20 dark:bg-teal/10 rounded-lg h-48"></div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="bg-margarita/20 dark:bg-margarita/10 rounded-lg h-48"></div>
              <div className="bg-pink/20 dark:bg-pink/10 rounded-lg h-64"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
