"use client";

import { useState } from "react";
import type { Review } from "@/lib/reviews";

/**
 * Pagination only. The review text itself is server-rendered by
 * `SocialProofSection`, so it is in the HTML Google reads — this component
 * receives it as props rather than fetching it.
 */
export default function ReviewCarousel({ reviews }: { reviews: Review[] }) {
  const reviewsPerPage = 3;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(reviews.length / reviewsPerPage));
  const startIndex = (currentPage - 1) * reviewsPerPage;
  const currentReviews = reviews.slice(startIndex, startIndex + reviewsPerPage);

  if (reviews.length === 0) {
    return (
      <div className="col-span-full text-center py-8">
        <div className="text-base sm:text-lg text-charcoal/80 dark:text-white/80">
          Reviews are unavailable right now — give us a call and we&apos;ll
          gladly put you in touch with recent customers.
        </div>
      </div>
    );
  }

  return (
    <>
      {currentReviews.map((review) => (
        <article
          key={review._id}
          className="bg-light dark:bg-charcoal/50 p-4 sm:p-6 rounded-lg"
        >
          <div className="flex items-center mb-3 sm:mb-4">
            <div
              className="flex text-orange"
              aria-label={`${review.rating} out of 5 stars`}
            >
              {[...Array(review.rating)].map((_, i) => (
                <svg
                  key={i}
                  aria-hidden="true"
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
        </article>
      ))}

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
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-charcoal dark:text-white bg-light dark:bg-charcoal/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-light/80 dark:hover:bg-charcoal/40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
