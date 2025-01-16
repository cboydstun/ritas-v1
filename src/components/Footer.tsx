import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold text-margarita mb-4">
              SATX Ritas
            </h3>
            <p className="text-charcoal mb-4">
              Bringing the party to San Antonio with premium frozen drink
              machine rentals. Perfect for any celebration!
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-teal mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/rentals"
                  className="text-charcoal hover:text-margarita transition-colors"
                >
                  Our Machines
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-charcoal hover:text-margarita transition-colors"
                >
                  Rental Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-charcoal hover:text-margarita transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-teal mb-4">Contact Us</h4>
            <ul className="space-y-2 text-charcoal">
              <li>San Antonio, TX</li>
              <li>
                <a
                  href="tel:+12105555555"
                  className="hover:text-margarita transition-colors"
                >
                  (210) 555-5555
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@satxritas.com"
                  className="hover:text-margarita transition-colors"
                >
                  info@satxritas.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-center text-charcoal">
            © {new Date().getFullYear()} SATX Ritas. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
