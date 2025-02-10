"use client";

import { useEffect, useState } from "react";

interface Review {
  _id: string;
  authorName: string;
  rating: number;
  text: string;
  time: string;
}

export default function SocialProofSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const reviewsPerPage = 3;
  const totalPages = Math.ceil(reviews.length / reviewsPerPage);
  const startIndex = (currentPage - 1) * reviewsPerPage;
  const currentReviews = reviews.slice(startIndex, startIndex + reviewsPerPage);

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((acc, review) => acc + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch("https://paparaz.me/api/v1/reviews");
        if (!response.ok) {
          throw new Error("Failed to fetch reviews");
        }
        const data = await response.json();
        setReviews(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reviews");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, []);

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
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {reviews.length * 8}
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              Happy Customers
            </div>
          </div>
          <div className="text-center p-2">
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {averageRating}
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              Average Rating
            </div>
          </div>
          <div className="text-center p-2">
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {reviews.filter((r) => r.rating >= 4).length}
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              5-Star Reviews
            </div>
          </div>
          <div className="text-center p-2">
            <div className="text-2xl sm:text-4xl font-bold text-margarita mb-1 sm:mb-2">
              {Math.round(
                (reviews.filter((r) => r.rating >= 4).length / reviews.length) *
                  100 || 0,
              )}
              %
            </div>
            <div className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
              Satisfaction Rate
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
          {isLoading ? (
            <div className="col-span-full text-center py-8">
              <div className="text-base sm:text-lg text-charcoal/80 dark:text-white/80">
                Loading reviews...
              </div>
            </div>
          ) : error ? (
            <div className="col-span-full text-center py-8">
              <div className="text-base sm:text-lg text-red-500">{error}</div>
            </div>
          ) : (
            <>
              {currentReviews.map((review) => (
                <div
                  key={review._id}
                  className="bg-light dark:bg-charcoal/50 p-4 sm:p-6 rounded-lg"
                >
                  <div className="flex items-center mb-3 sm:mb-4">
                    <div className="flex text-orange">
                      {[...Array(review.rating)].map((_, i) => (
                        <svg
                          key={i}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm sm:text-base text-charcoal/80 dark:text-white/80 mb-3 sm:mb-4">
                    {review.text}
                  </p>
                  <div className="font-semibold text-sm sm:text-base text-charcoal dark:text-white">
                    {review.authorName}
                  </div>
                  <div className="text-xs sm:text-sm text-charcoal/80 dark:text-white/80">
                    {new Date(review.time).toLocaleDateString()}
                  </div>
                </div>
              ))}

              {/* Pagination Controls */}
              {reviews.length > reviewsPerPage && (
                <div className="col-span-full flex flex-col sm:flex-row justify-center items-center gap-3 mt-6 sm:mt-8">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-charcoal dark:text-white bg-light dark:bg-charcoal/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light/80 dark:hover:bg-charcoal/40 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm sm:text-base text-charcoal/80 dark:text-white/80">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-charcoal dark:text-white bg-light dark:bg-charcoal/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light/80 dark:hover:bg-charcoal/40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
