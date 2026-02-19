import Link from "next/link";

interface BookingCTAProps {
  headline?: string;
  subtext?: string;
  className?: string;
}

export default function BookingCTA({
  headline = "Ready to Book?",
  subtext = "Reserve your frozen drink machine today. Professional delivery, setup, and pickup — all included. Serving Bexar County with no hidden fees.",
  className = "",
}: BookingCTAProps) {
  return (
    <section
      className={`bg-gradient-to-r from-orange to-pink rounded-2xl shadow-xl overflow-hidden ${className}`}
    >
      <div className="relative px-8 py-12 text-center">
        {/* Decorative blobs */}
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="mb-3 text-4xl">🍹</div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            {headline}
          </h2>
          <p className="text-white/85 text-lg max-w-2xl mx-auto mb-8">
            {subtext}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/order"
              className="inline-block px-10 py-4 bg-white text-orange font-bold rounded-xl text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              Book Now
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-10 py-4 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-xl text-lg border border-white/30 hover:-translate-y-1 transition-all duration-200"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
