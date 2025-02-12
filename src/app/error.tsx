"use client";

import { useLogger, LogLevel } from "next-axiom";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const log = useLogger({ source: "error.tsx" });

  useEffect(() => {
    // Log the error to Axiom
    log.logHttpRequest(
      LogLevel.error,
      error.message,
      {
        host: window.location.href,
        path: pathname,
        statusCode: error.message === "Invalid URL" ? 404 : 500,
      },
      {
        error: error.name,
        cause: error.cause,
        stack: error.stack,
        digest: error.digest,
      }
    );
  }, [error, log, pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
        <p className="text-lg mb-8">
          We apologize for the inconvenience. Please try again later.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
