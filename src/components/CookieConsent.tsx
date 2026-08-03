"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";

/**
 * Opt-out notice for Consent Mode v2.
 *
 * Consent defaults to `granted` (see `GoogleAnalytics.tsx`), so this bar is a
 * disclosure with an opt-out rather than a gate — which is what Texas TDPSA
 * asks for. It renders only until the visitor makes a choice, and the choice
 * is re-applied on later visits by the inline bootstrap, not by this
 * component, so opting out still holds on the very first hit of a session.
 */
export default function CookieConsent(): React.ReactNode {
  // Starts hidden so the server-rendered markup and the first client render
  // agree; the effect below reveals it once localStorage can be read.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const choose = (choice: "granted" | "denied") => {
    setConsent(choice);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-0 inset-x-0 z-50 p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl bg-white/95 dark:bg-charcoal/95 backdrop-blur-lg shadow-xl border border-charcoal/10 dark:border-white/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-charcoal/80 dark:text-white/80 flex-grow">
          We use cookies to measure site traffic and ad performance. You can opt
          out at any time — see our{" "}
          <Link
            href="/contact"
            className="underline hover:text-margarita transition-colors"
          >
            contact page
          </Link>{" "}
          to ask about your data.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-charcoal/70 dark:text-white/70 hover:bg-charcoal/5 dark:hover:bg-white/10 transition-colors"
          >
            Opt out
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-margarita text-charcoal hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
