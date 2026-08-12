import ReviewCarousel from "./ReviewCarousel";
import { getReviewSummary } from "@/lib/reviews";

/**
 * Server component: the review text and the headline numbers are in the HTML
 * Google reads. This was a client component fetching `/api/v1/reviews` in an
 * effect, so the reviews existed only after hydration and the section rendered
 * "0 / 0.0 / Loading reviews..." on first paint.
 */
export default async function SocialProofSection() {
  const { reviews, count, averageRating, fiveStarCount, satisfactionRate } =
    await getReviewSummary();

  return (
    <div className="bg-white dark:bg-charcoal py-8 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-charcoal dark:text-white mb-2 sm:mb-4">
            Trusted by San Antonio&apos;s Best
          </h2>
          <p className="text-base sm:text-lg text-charcoal/80 dark:text-white/80">
            Join hundreds of satisfied customers who chose SATX Ritas
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="mb-8 sm:mb-12 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 items-center">
          <div className="text-center p-2">
            {/* The real review count. This used to be `reviews.length * 8`,
                a made-up multiplier presented to visitors as a fact. */}
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {count}
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              Customer Reviews
            </div>
          </div>
          <div className="text-center p-2">
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {averageRating?.toFixed(1) ?? "—"}
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              Average Rating
            </div>
          </div>
          <div className="text-center p-2">
            {/* Counts 5s only. The tile said "5-Star" while filtering >= 4. */}
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {fiveStarCount}
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              5-Star Reviews
            </div>
          </div>
          <div className="text-center p-2">
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {satisfactionRate}%
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              Satisfaction Rate
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
          <ReviewCarousel reviews={reviews} />
        </div>
      </div>
    </div>
  );
}
