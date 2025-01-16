export default function MapSection() {
  return (
    <div className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-charcoal mb-4">
            Service Area
          </h2>
          <p className="text-lg text-charcoal/70">
            Proudly serving San Antonio and surrounding areas
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Map Placeholder */}
          <div className="relative aspect-video bg-light rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-margarita/10 to-teal/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <svg
                  className="w-16 h-16 text-teal mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-charcoal/60">
                  Interactive map coming soon
                </span>
              </div>
            </div>
          </div>

          {/* Service Areas List */}
          <div>
            <h3 className="text-xl font-semibold text-charcoal mb-6">
              Areas We Serve
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-teal mb-3">Central</h4>
                <ul className="space-y-2 text-charcoal/80">
                  <li>Downtown San Antonio</li>
                  <li>Alamo Heights</li>
                  <li>Olmos Park</li>
                  <li>Monte Vista</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-teal mb-3">North</h4>
                <ul className="space-y-2 text-charcoal/80">
                  <li>Stone Oak</li>
                  <li>Shavano Park</li>
                  <li>Hollywood Park</li>
                  <li>Castle Hills</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-teal mb-3">Northwest</h4>
                <ul className="space-y-2 text-charcoal/80">
                  <li>Leon Valley</li>
                  <li>Helotes</li>
                  <li>The Dominion</li>
                  <li>La Cantera</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-teal mb-3">Northeast</h4>
                <ul className="space-y-2 text-charcoal/80">
                  <li>Schertz</li>
                  <li>Universal City</li>
                  <li>Converse</li>
                  <li>Live Oak</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 bg-light rounded-lg">
              <p className="text-charcoal/80">
                <span className="font-semibold text-teal">Note:</span> We serve
                additional areas within 30 miles of downtown San Antonio.
                Contact us to confirm service availability for your location.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
