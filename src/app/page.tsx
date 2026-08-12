import { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import SocialProofSection from "@/components/home/SocialProofSection";
import AboutSection from "@/components/home/AboutSection";
import MapSection from "@/components/home/MapSection";
import BookingCTA from "@/components/BookingCTA";
import { BUSINESS_ID, SITE_URL } from "@/lib/site";
import { getReviewSummary, type ReviewSummary } from "@/lib/reviews";

// Add JSON-LD structured data for LocalBusiness
const baseJsonLd = {
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
  // /contact declared these and this node did not, even though this is the
  // one carrying the canonical @id and the aggregateRating — so the richer
  // description hung off the weaker node. Kept identical to /contact's.
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "10:00",
      closes: "16:00",
    },
  ],
};

/**
 * The LocalBusiness node with the review feed folded in.
 *
 * `aggregateRating` is what makes the listing eligible for star ratings in
 * search results, and it has to describe reviews that are actually on the
 * page — which is why SocialProofSection is server-rendered. Omitted entirely
 * when the feed is empty: a rating of 0 out of 0 is worse than none.
 */
function buildJsonLd(summary: ReviewSummary) {
  if (summary.count === 0 || summary.averageRating === null) return baseJsonLd;

  return {
    ...baseJsonLd,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.averageRating,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: summary.reviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorName },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.text,
      ...(review.time ? { datePublished: review.time } : {}),
    })),
  };
}

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "SATX Ritas Rentals | Frozen Drink Machine Rentals in San Antonio",
  description:
    "Premium frozen drink machine rentals in San Antonio, TX. Perfect for parties, weddings, and events. Serving margaritas, daiquiris, and more with professional setup and service.",
  openGraph: {
    title: "SATX Ritas Rentals | Frozen Drink Machine Rentals in San Antonio",
    description:
      "Premium frozen drink machine rentals in San Antonio, TX. Perfect for parties, weddings, and events. Serving margaritas, daiquiris, and more with professional setup and service.",
    url: `${SITE_URL}/`,
    images: [`${SITE_URL}/og-image.jpg`],
    type: "website",
  },
};

export default async function Home() {
  const reviewSummary = await getReviewSummary();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(reviewSummary)),
        }}
      />
      <div>
        <HeroSection />
        <SocialProofSection />
        <AboutSection />
        <MapSection />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <BookingCTA />
        </div>
      </div>
    </>
  );
}
