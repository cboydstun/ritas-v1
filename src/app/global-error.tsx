"use client";

/**
 * Last-resort boundary for a throw in the root layout, where `error.tsx`
 * cannot help because the layout that renders it is the thing that failed.
 * Without this file the visitor saw Next's unstyled default page.
 *
 * It must render its own <html> and <body>: it replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // `compiler.removeConsole` now keeps error and warn in production, so this
  // actually reaches the runtime logs.
  console.error("Root layout error:", error);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          textAlign: "center",
          color: "#333333",
          background: "#f7f7f7",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "1rem 0 1.5rem" }}>
            Sorry — the page could not be loaded. You can try again, or call us
            on (512) 210-0194 and we will take your booking over the phone.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#4b7a0a",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
