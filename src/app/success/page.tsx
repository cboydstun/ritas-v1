import SuccessPageContent from "./SuccessPageContent";

/**
 * Server shell.
 *
 * `page.tsx` used to be the `"use client"` component itself, which meant Next
 * silently ignored the sibling `metadata.ts` — including its `robots.index:
 * false` — so confirmation URLs carrying a bookingId were crawlable and shared
 * the homepage's title.
 */
export { metadata } from "./metadata";

export default function SuccessPage() {
  return <SuccessPageContent />;
}

export const dynamic = "force-dynamic";
