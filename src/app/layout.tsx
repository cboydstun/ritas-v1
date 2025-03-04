import "./globals.css";
import { Metadata } from "next";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NODE_ENV === "production"
      ? "https://satxritas.com"
      : "http://localhost:3000"
  ),
  title: "Ritas Rentals",
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
import ThemeWrapper from "@/components/ThemeWrapper";
import GoogleAnalytics from "@/components/GoogleAnalytics";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <GoogleAnalytics />
      <body
        className={`${poppins.className} flex flex-col min-h-screen bg-white dark:bg-charcoal dark:text-white`}
      >
        <ThemeWrapper>
          <Navigation />
          <main className="flex-grow">{children}</main>
          <Footer />
        </ThemeWrapper>
      </body>
    </html>
  );
}
