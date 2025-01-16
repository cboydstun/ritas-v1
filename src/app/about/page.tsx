export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 rounded-full blur-xl animate-pulse" />
      </div>

      {/* Our Story Section */}
      <div className="relative pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal mb-6 tracking-tight">
              Our
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
                Story
              </span>
            </h1>
            <div className="max-w-3xl mx-auto">
              <p className="text-xl text-charcoal/80 mb-6">
                We started SATX Ritas with a passion for creating unforgettable
                moments at San Antonio events through premium frozen drink
                experiences.
              </p>
              <p className="text-xl text-charcoal/80 mb-6">
                What began as a vision to elevate local celebrations has grown
                into San Antonio&apos;s trusted source for professional-grade
                frozen drink machine rentals.
              </p>
              <p className="text-xl text-charcoal/80">
                From backyard gatherings to corporate events, we&apos;ve become
                known for our commitment to quality equipment, exceptional
                service, and the perfect frozen drinks that bring people
                together.
              </p>
            </div>
          </div>

          {/* Why Choose Us Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-24">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold text-charcoal mb-3">
                Quality First
              </h3>
              <p className="text-charcoal/70">
                Commercial-grade machines maintained to the highest standards,
                ensuring consistent, restaurant-quality frozen drinks every
                time.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-bold text-charcoal mb-3">
                Dependable Service
              </h3>
              <p className="text-charcoal/70">
                Precise delivery and professional setup, with expert training to
                ensure your event runs smoothly from start to finish.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-bold text-charcoal mb-3">
                Premium Support
              </h3>
              <p className="text-charcoal/70">
                24/7 technical assistance throughout your rental period, because
                we know great service doesn&apos;t end with delivery.
              </p>
            </div>
          </div>

          {/* Our Values */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-12 shadow-xl mb-24">
            <h2 className="text-4xl font-bold text-charcoal mb-12 text-center">
              Our Values
            </h2>
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold text-charcoal mb-4">
                    Excellence in Service
                  </h3>
                  <p className="text-charcoal/70">
                    Every rental experience is an opportunity to exceed
                    expectations. From our premium machines to our white-glove
                    service, we ensure every detail is perfect.
                  </p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-charcoal mb-4">
                    Reliability
                  </h3>
                  <p className="text-charcoal/70">
                    When you book with SATX Ritas, you can trust that your
                    machine will arrive on time, work perfectly, and create the
                    exact frozen drinks you envisioned.
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold text-charcoal mb-4">
                    Local Commitment
                  </h3>
                  <p className="text-charcoal/70">
                    As a San Antonio-based business, we take pride in serving
                    our community and being part of the celebrations that make
                    our city special.
                  </p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-charcoal mb-4">
                    Customer Success
                  </h3>
                  <p className="text-charcoal/70">
                    Your event&apos;s success is our success. We provide
                    comprehensive support and guidance to ensure your frozen
                    drinks are a hit with your guests.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Area */}
          <div className="bg-gradient-to-r from-margarita/20 to-teal/20 rounded-2xl p-12 shadow-xl">
            <h2 className="text-4xl font-bold text-charcoal mb-8 text-center">
              Serving San Antonio
            </h2>
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xl text-charcoal/80 mb-6">
                We proudly serve the entire San Antonio metropolitan area,
                bringing premium frozen drink experiences to events throughout
                the region.
              </p>
              <p className="text-xl text-charcoal/80">
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
