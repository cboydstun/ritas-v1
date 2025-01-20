import { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import SocialProofSection from "@/components/home/SocialProofSection";
import AboutSection from "@/components/home/AboutSection";
import MapSection from "@/components/home/MapSection";

// Add JSON-LD structured data for LocalBusiness
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "SATX Ritas Rentals",
  image: "https://satxritas.com/og-image.jpg",
  description:
    "Premium frozen drink machine rentals in San Antonio, TX. Perfect for parties, weddings, and events.",
  "@id": "https://satxritas.com",
  url: "https://satxritas.com",
  telephone: "+1-210-000-0000",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "123 Main St",
    addressLocality: "San Antonio",
    addressRegion: "TX",
    postalCode: "78201",
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
  title: "SATX Ritas Rentals | Frozen Drink Machine Rentals in San Antonio",
  description:
    "Premium frozen drink machine rentals in San Antonio, TX. Perfect for parties, weddings, and events. Serving margaritas, daiquiris, and more with professional setup and service.",
  alternates: {
    canonical: "https://satxritas.com",
  },
  other: {
    "script:ld+json": JSON.stringify(jsonLd),
  },
};

export default function Home() {
  return (
    <main>
      <HeroSection />
      <SocialProofSection />
      <AboutSection />
      <MapSection />
    </main>
  );
}
