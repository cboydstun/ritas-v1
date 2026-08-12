import "./globals.css";
import { Metadata } from "next";
import { Poppins } from "next/font/google";
import { SITE_URL } from "@/lib/site";

/** Production domain, the preview deployment's own host, or localhost. */
function siteOrigin(): string {
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV) {
    return SITE_URL;
  }
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const poppins = Poppins({
  subsets: ["latin"],
  // 800 is loaded because `font-extrabold` is on the <h1> of nearly every
  // page and was rendering as faux-bold; 300 is not, because `font-light` is
  // used nowhere and was costing a preloaded woff2 for nothing.
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  // Preview deploys are neither production nor localhost: falling back to
  // localhost there emitted `http://localhost:3000/...` canonicals and OG
  // image URLs in every preview build.
  metadataBase: new URL(siteOrigin()),
  // A template rather than a bare string: any route without its own title used
  // to render "Ritas Rentals", which matched neither the openGraph title below
  // nor the brand string on the homepage.
  title: {
    default:
      "SATX Ritas Rentals | Frozen Drink Machine Rentals in San Antonio, TX",
    template: "%s | SATX Ritas Rentals",
  },
  description:
    "Rent top-quality frozen drink machines in San Antonio, TX for your next party or event. Offering margaritas, daiquiris, piña coladas, and more with professional service. Perfect for birthdays, weddings, and corporate events. Visit SATXRitas.com for pricing and booking!",
  openGraph: {
    title: "SATX Ritas Rentals",
    description:
      "Rent top-quality frozen drink machines in San Antonio, TX for your next party or event. Offering margaritas, daiquiris, piña coladas, and more with professional service. Perfect for birthdays, weddings, and corporate events. Visit SATXRitas.com for pricing and booking!",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Ritas Rentals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SATX Ritas Rentals",
    description:
      "Rent top-quality frozen drink machines in San Antonio, TX for your next party or event. Offering margaritas, daiquiris, piña coladas, and more with professional service. Perfect for birthdays, weddings, and corporate events. Visit SATXRitas.com for pricing and booking!",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: [
      {
        url: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    other: [
      {
        url: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import StickyCallBar from "@/components/StickyCallBar";
import ThemeWrapper from "@/components/ThemeWrapper";
import AnalyticsGate from "@/components/AnalyticsGate";
import FingerprintTracker from "@/components/FingerprintTracker";
import ContactLinkTracker from "@/components/ContactLinkTracker";
import CookieConsent from "@/components/CookieConsent";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning is required by next-themes, which sets the
    // theme class on <html> before React hydrates. The class was previously
    // hardcoded to "light", fighting the provider.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.className} flex flex-col min-h-screen bg-white dark:bg-charcoal dark:text-white`}
      >
        {/* Analytics belongs inside <body>; between <html> and <body> is
            invalid markup that only worked via React 19 script hoisting.
            AnalyticsGate skips the admin area, the way FingerprintTracker
            already does. */}
        {/* First focusable element on every page: the nav has a dozen links
            before <main>, so without this a keyboard user tabs the whole
            header on every navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-charcoal focus:shadow-lg focus:ring-2 focus:ring-margarita dark:focus:bg-charcoal dark:focus:text-white"
        >
          Skip to main content
        </a>
        <AnalyticsGate />
        {/* SessionProvider used to wrap this tree, which put
            next-auth/react and its session fetch into the first-load JS of
            every customer-facing route. Every useSession/signIn/signOut
            caller is under /admin, so the provider lives in
            app/admin/layout.tsx now. */}
        <ThemeWrapper>
          <Navigation />
          {/* pb-16 on mobile clears the fixed StickyCallBar, which would
              otherwise cover the last row of the footer. */}
          <main id="main" tabIndex={-1} className="grow pb-16 sm:pb-0">
            {children}
          </main>
          <Footer />
          <StickyCallBar />
          <FingerprintTracker />
          <ContactLinkTracker />
          <CookieConsent />
        </ThemeWrapper>
      </body>
    </html>
  );
}
