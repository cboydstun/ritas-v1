import Link from "next/link";

export default function HeroSection() {
  return (
    <div className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
      {/* Decorative Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 rounded-full blur-xl animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <div className="mb-8 inline-block">
            <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
              🍹 Party Time!
            </span>
          </div>

          <h1 className="text-6xl md:text-7xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
            Fresh, Authentic
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2 pb-4">
              San Antonio Margaritas
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-charcoal/80 dark:text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed">
            Bringing the taste of San Antonio to your next event. Professional
            margarita machine rentals for parties, weddings, and corporate
            events.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              href="/order"
              className="group px-8 py-4 bg-gradient-to-r from-orange to-pink text-white text-lg font-bold rounded-xl 
                hover:shadow-lg hover:shadow-orange/30 transform hover:-translate-y-1 transition-all duration-300
                relative overflow-hidden"
            >
              <span className="relative z-10">ORDER ONLINE</span>
              <div className="absolute inset-0 bg-gradient-to-r from-pink to-orange opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>

            <Link
              href="/pricing"
              className="group px-8 py-4 bg-gradient-to-r from-teal to-margarita text-white text-lg font-bold rounded-xl
                hover:shadow-lg hover:shadow-teal/30 transform hover:-translate-y-1 transition-all duration-300
                relative overflow-hidden"
            >
              <span className="relative z-10">View Pricing</span>
              <div className="absolute inset-0 bg-gradient-to-r from-margarita to-teal opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
