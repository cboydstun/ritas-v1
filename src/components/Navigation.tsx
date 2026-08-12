"use client";
import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_HREF } from "@/lib/site";

/** Inline so the header does not pull in an icon package for one glyph. */
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
  );
}

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white dark:bg-charcoal shadow-md relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo/Brand */}
            <Link
              href="/"
              className="flex items-center"
              onClick={closeMobileMenu}
            >
              <span className="text-2xl font-bold text-margarita dark:text-margarita-dark hover:text-teal transition-colors">
                🍹SATX Ritas
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden sm:flex sm:items-center">
            <Link
              href="/pricing"
              className="px-3 py-2 text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="px-3 py-2 text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark transition-colors"
            >
              About
            </Link>
            <Link
              href="/faq"
              className="px-3 py-2 text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/blog"
              className="px-3 py-2 text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/long-term-lease"
              className="px-3 py-2 text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark transition-colors"
            >
              Long-Term Lease
            </Link>
            <Link
              href="/contact"
              className="px-3 py-2 text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark transition-colors"
            >
              Contact
            </Link>
            {/* The number was in the footer and on two inner pages only. For
                a local rental business, a header click-to-call is the
                shortest path from "interested" to "booked". */}
            <a
              href={BUSINESS_PHONE_HREF}
              className="ml-2 px-3 py-2 flex items-center gap-1.5 font-semibold text-margarita dark:text-margarita-dark hover:text-teal transition-colors"
            >
              <PhoneIcon className="h-4 w-4" />
              {BUSINESS_PHONE_DISPLAY}
            </a>
            <Link
              href="/order"
              className="ml-4 px-4 py-2 bg-margarita text-white rounded-lg hover:bg-teal transition-colors animate-wiggle hover:animate-none"
            >
              Order Online
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center">
            <a
              href={BUSINESS_PHONE_HREF}
              className="p-2 text-margarita dark:text-margarita-dark hover:text-teal transition-colors"
            >
              <span className="sr-only">Call {BUSINESS_PHONE_DISPLAY}</span>
              <PhoneIcon className="h-6 w-6" />
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark focus:outline-hidden focus:ring-2 focus:ring-margarita focus:ring-offset-1"
              onClick={toggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <span className="sr-only">
                {isMobileMenuOpen ? "Close main menu" : "Open main menu"}
              </span>
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
        id="mobile-menu"
        // Hidden from the accessibility tree and from tab order when closed.
        // opacity-0 alone left every link focusable and announced.
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen}
        className={`sm:hidden fixed inset-0 bg-white/95 dark:bg-charcoal/95 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ marginTop: "64px" }}
      >
        <div className="px-4 pt-2 pb-3 space-y-1">
          <Link
            href="/pricing"
            className="block px-3 py-4 text-base font-medium text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark border-b border-gray-200 dark:border-gray-700"
            onClick={closeMobileMenu}
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="block px-3 py-4 text-base font-medium text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark border-b border-gray-200 dark:border-gray-700"
            onClick={closeMobileMenu}
          >
            About
          </Link>
          <Link
            href="/faq"
            className="block px-3 py-4 text-base font-medium text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark border-b border-gray-200 dark:border-gray-700"
            onClick={closeMobileMenu}
          >
            FAQ
          </Link>
          <Link
            href="/blog"
            className="block px-3 py-4 text-base font-medium text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark border-b border-gray-200 dark:border-gray-700"
            onClick={closeMobileMenu}
          >
            Blog
          </Link>
          <Link
            href="/long-term-lease"
            className="block px-3 py-4 text-base font-medium text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark border-b border-gray-200 dark:border-gray-700"
            onClick={closeMobileMenu}
          >
            Long-Term Lease
          </Link>
          <Link
            href="/contact"
            className="block px-3 py-4 text-base font-medium text-charcoal dark:text-white hover:text-margarita dark:hover:text-margarita-dark border-b border-gray-200 dark:border-gray-700"
            onClick={closeMobileMenu}
          >
            Contact
          </Link>
          <Link
            href="/order"
            className="block px-3 py-4 text-base font-medium text-white bg-margarita hover:bg-teal rounded-lg mt-4 text-center transition-colors animate-wiggle hover:animate-none"
            onClick={closeMobileMenu}
          >
            Order Online
          </Link>
          <div className="flex justify-center mt-4 pb-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
