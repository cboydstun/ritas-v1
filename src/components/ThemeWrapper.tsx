"use client";

import { ThemeProvider } from "next-themes";

/**
 * This component used to withhold `children` behind a `mounted` flag and
 * render them with `visibility: hidden` until the client had hydrated. Since
 * it wraps the navigation, `<main>` and the footer in the root layout, that
 * meant every page — including the hero and its LCP text — was invisible until
 * the JS bundle parsed, and a no-JS or bot render saw a blank page.
 *
 * `next-themes` handles this itself: it injects a blocking script that sets
 * the theme class before paint, which is why `<html>` carries
 * `suppressHydrationWarning` in the root layout.
 */
export default function ThemeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
