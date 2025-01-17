export default function SocialProofSection() {
  return (
    <div className="bg-white dark:bg-charcoal py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-4">
            Trusted by San Antonio's Best
          </h2>
          <p className="text-lg text-charcoal/70 dark:text-white/70">
            Join hundreds of satisfied customers who chose SATX Ritas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Testimonial 1 */}
          <div className="bg-light dark:bg-charcoal/50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="flex text-orange">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-charcoal/80 dark:text-white/80 mb-4">
              "The margaritas were a huge hit at our wedding! Professional
              service and amazing taste. Highly recommend!"
            </p>
            <div className="font-semibold text-charcoal dark:text-white">
              Maria R.
            </div>
            <div className="text-sm text-charcoal/60 dark:text-white/60">
              Wedding Reception
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-light dark:bg-charcoal/50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="flex text-orange">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-charcoal/80 dark:text-white/80 mb-4">
              "Best corporate event decision ever! The team was punctual,
              professional, and the margaritas were perfect."
            </p>
            <div className="font-semibold text-charcoal dark:text-white">
              John D.
            </div>
            <div className="text-sm text-charcoal/60 dark:text-white/60">
              Corporate Event Planner
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-light dark:bg-charcoal/50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="flex text-orange">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-charcoal/80 dark:text-white/80 mb-4">
              "These guys know their margaritas! Setup was quick, cleanup was
              spotless, and the drinks were fantastic."
            </p>
            <div className="font-semibold text-charcoal dark:text-white">
              Sarah M.
            </div>
            <div className="text-sm text-charcoal/60 dark:text-white/60">
              Birthday Party Host
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-margarita mb-2">500+</div>
            <div className="text-charcoal/70 dark:text-white/70">
              Events Served
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-margarita mb-2">4.9</div>
            <div className="text-charcoal/70 dark:text-white/70">
              Average Rating
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-margarita mb-2">50k+</div>
            <div className="text-charcoal/70 dark:text-white/70">
              Margaritas Served
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-margarita mb-2">100%</div>
            <div className="text-charcoal/70 dark:text-white/70">
              Satisfaction Rate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
