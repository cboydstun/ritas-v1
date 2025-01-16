"use client";
import Link from "next/link";
import { useState } from "react";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-md relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo/Brand */}
            <Link
              href="/"
              className="flex items-center"
              onClick={closeMobileMenu}
            >
              <span className="text-2xl font-bold text-margarita hover:text-teal transition-colors">
                SATX Ritas
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden sm:flex sm:items-center">
            <Link
              href="/rentals"
              className="px-3 py-2 text-charcoal hover:text-margarita transition-colors"
            >
              Rentals
            </Link>
            <Link
              href="/pricing"
              className="px-3 py-2 text-charcoal hover:text-margarita transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="px-3 py-2 text-charcoal hover:text-margarita transition-colors"
            >
              About
            </Link>
            <Link
              href="/faq"
              className="px-3 py-2 text-charcoal hover:text-margarita transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="ml-4 px-4 py-2 bg-margarita text-white rounded-lg hover:bg-teal transition-colors"
            >
              Contact Us
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-charcoal hover:text-margarita focus:outline-none"
              onClick={toggleMobileMenu}
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger Icon */}
              <svg
                className={`h-6 w-6 transition-transform duration-200 ease-in-out ${
                  isMobileMenuOpen ? "transform rotate-180" : ""
                }`}
                stroke="currentColor"
                fill="none"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`sm:hidden fixed inset-0 bg-white/95 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ marginTop: "64px" }}
      >
        <div className="px-4 pt-2 pb-3 space-y-1">
          <Link
            href="/rentals"
            className="block px-3 py-4 text-base font-medium text-charcoal hover:text-margarita border-b border-gray-200"
            onClick={closeMobileMenu}
          >
            Rentals
          </Link>
          <Link
            href="/pricing"
            className="block px-3 py-4 text-base font-medium text-charcoal hover:text-margarita border-b border-gray-200"
            onClick={closeMobileMenu}
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="block px-3 py-4 text-base font-medium text-charcoal hover:text-margarita border-b border-gray-200"
            onClick={closeMobileMenu}
          >
            About
          </Link>
          <Link
            href="/faq"
            className="block px-3 py-4 text-base font-medium text-charcoal hover:text-margarita border-b border-gray-200"
            onClick={closeMobileMenu}
          >
            FAQ
          </Link>
          <Link
            href="/contact"
            className="block px-3 py-4 text-base font-medium text-white bg-margarita hover:bg-teal rounded-lg mt-4 text-center transition-colors"
            onClick={closeMobileMenu}
          >
            Contact Us
          </Link>
        </div>
      </div>
    </nav>
  );
}
