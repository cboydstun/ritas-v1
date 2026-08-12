"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_HREF } from "@/lib/site";

/**
 * Mobile-only call/book bar.
 *
 * A large share of visitors to a local rental business arrive on a phone
 * wanting to talk to someone, and the number appeared nowhere above the fold
 * — it was in the footer and on two inner pages. `ContactLinkTracker` already
 * emits a `contact_click` GA4 event for every `tel:` anchor, so this is
 * measurable the moment it ships.
 *
 * Hidden on the order wizard, whose own Previous/Next controls sit at the
 * bottom of the viewport, and on the admin area.
 */
export default function StickyCallBar() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/order")) {
    return null;
  }

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-charcoal/95 backdrop-blur-xs">
      <a
        href={BUSINESS_PHONE_HREF}
        className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-margarita"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
        Call {BUSINESS_PHONE_DISPLAY}
      </a>
      <Link
        href="/order"
        className="flex-1 flex items-center justify-center py-4 font-semibold text-white bg-margarita"
      >
        Book Online
      </Link>
    </div>
  );
}
