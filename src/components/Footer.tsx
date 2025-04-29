import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-light dark:bg-charcoal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold text-margarita mb-4">
              SATX Ritas
            </h3>
            <p className="text-charcoal dark:text-white/80 mb-4">
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
                  href="/order"
                  className="text-charcoal dark:text-white/80 hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  Order Online
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-charcoal dark:text-white/80 hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-charcoal dark:text-white/80 hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-charcoal dark:text-white/80 hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-charcoal dark:text-white/80 hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-teal mb-4">Contact Us</h4>
            <ul className="space-y-2 text-charcoal dark:text-white/80">
              <li>San Antonio, TX</li>
              <li>
                <a
                  href="tel:+15122100194"
                  className="hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  (512) 210-0194
                </a>
              </li>
              <li>
                <a
                  href="mailto:satxbounce@gmail.com"
                  className="hover:text-margarita dark:hover:text-margarita transition-colors"
                >
                  satxbounce@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-charcoal dark:text-white/80">
            © {new Date().getFullYear()} SATX Ritas. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
