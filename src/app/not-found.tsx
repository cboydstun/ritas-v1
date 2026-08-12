import type { Metadata } from "next";
import Link from "next/link";

// Without this the 404 inherited the root title and its OG card advertised the
// homepage, so a shared dead link previewed as if it were the real site.
export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This page could not be found.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-light dark:bg-charcoal flex items-center justify-center px-4">
      <div className="text-center text-charcoal dark:text-white">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-lg mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-margarita hover:bg-margarita/90 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-margarita"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
