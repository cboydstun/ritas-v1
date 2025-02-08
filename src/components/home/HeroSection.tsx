import Link from "next/link";

export default function HeroSection() {
  return (
    <div className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
      {/* Content - Moved to top for faster LCP */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <div className="mb-8 inline-block">
            <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
              🍹 Party Time!
            </span>
          </div>

          <h1 className="text-6xl md:text-7xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight will-change-transform">
            Frozen Drink Machines
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2 pb-4">
              in San Antonio
            </span>
            for Margaritas & More!
          </h1>

          <p className="text-xl md:text-2xl text-charcoal/80 dark:text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed">
            Bringing the taste of San Antonio to your next event. Commercial
            margarita machine rentals for parties, weddings, and corporate
            events.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              href="/order"
              className="group px-8 py-4 bg-gradient-to-r from-orange to-pink text-white text-lg font-bold rounded-xl 
                hover:opacity-90 transition-opacity duration-300"
            >
              <span className="relative z-10">ORDER ONLINE</span>
            </Link>

            <Link
              href="/pricing"
              className="group px-8 py-4 bg-gradient-to-r from-teal to-margarita text-white text-lg font-bold rounded-xl
                hover:opacity-90 transition-opacity duration-300"
            >
              <span className="relative z-10">View Pricing</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Decorative Elements - Moved after main content */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 rounded-full blur-xl" />
      </div>

      {/* Wave SVG - Moved after main content */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none">
        <div className="relative">
          <svg
            width="1440"
            height="120"
            className="relative w-full h-[100px] animate-[wave_10s_ease-in-out_infinite] will-change-transform"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
          >
            <path
              className="fill-[#ffffff] dark:fill-charcoal/90"
              d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z"
            >
              <animate
                attributeName="d"
                dur="10s"
                repeatCount="indefinite"
                values="
                  M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z;
                  M0,60 C240,0 480,120 720,60 C960,0 1200,120 1440,60 L1440,120 L0,120 Z;
                  M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z"
              />
            </path>
          </svg>
        </div>
      </div>
    </div>
  );
}
