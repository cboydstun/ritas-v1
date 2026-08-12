import { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import SocialProofSection from "@/components/home/SocialProofSection";
import AboutSection from "@/components/home/AboutSection";
import MapSection from "@/components/home/MapSection";
import BookingCTA from "@/components/BookingCTA";
import { BUSINESS_ID, SITE_URL } from "@/lib/site";

// Add JSON-LD structured data for LocalBusiness
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "SATX Ritas Rentals",
  image: `${SITE_URL}/og-image.jpg`,
  description:
    "Premium frozen drink machine rentals in San Antonio, TX. Perfect for parties, weddings, and events.",
  // BUSINESS_ID, not SITE_URL: /order already used the shared id, so the
  // two pages described two different businesses to Google.
  "@id": BUSINESS_ID,
  url: SITE_URL,
  telephone: "+1-512-210-0194",
  email: "satxbounce@gmail.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "5106 Stormy Autumn",
    addressLocality: "San Antonio",
    addressRegion: "TX",
    postalCode: "78247",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 29.4241,
    longitude: -98.4936,
  },
  areaServed: {
    "@type": "GeoCircle",
    geoMidpoint: {
      "@type": "GeoCoordinates",
      latitude: 29.4241,
      longitude: -98.4936,
    },
    geoRadius: "50000",
  },
};

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "SATX Ritas Rentals | Frozen Drink Machine Rentals in San Antonio",
  description:
    "Premium frozen drink machine rentals in San Antonio, TX. Perfect for parties, weddings, and events. Serving margaritas, daiquiris, and more with professional setup and service.",
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <HeroSection />
        <SocialProofSection />
        <AboutSection />
        <MapSection />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <BookingCTA />
        </div>
      </main>
    </>
  );
}
