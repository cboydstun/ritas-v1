"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-light dark:bg-charcoal flex items-center justify-center px-4">
      <div className="text-center text-charcoal dark:text-white">
        <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
        <p className="text-lg mb-8">
          We apologize for the inconvenience. Please try again later.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-margarita hover:bg-margarita/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-margarita"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
