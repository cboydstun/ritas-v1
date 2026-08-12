/**
 * Server-side access to the shared review feed.
 *
 * The homepage used to fetch `/api/v1/reviews` from a client effect, so the
 * reviews existed only after hydration: Google never saw them, the page had no
 * `aggregateRating` to be eligible for SERP stars, and first paint showed
 * "0 / 0.0 / Loading reviews..." before snapping to real numbers.
 */

export interface Review {
  _id: string;
  authorName: string;
  rating: number;
  text: string;
  time: string;
}

export interface ReviewSummary {
  reviews: Review[];
  count: number;
  /** Mean rating to one decimal place, or null when there is nothing to average. */
  averageRating: number | null;
  fiveStarCount: number;
  /** Share of reviews rating 4 or 5, as a whole percentage. */
  satisfactionRate: number;
}

const REVIEWS_ENDPOINT = "https://satxbounce.com/api/v1/reviews";

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r._id === "string" &&
    typeof r.authorName === "string" &&
    typeof r.rating === "number" &&
    typeof r.text === "string"
  );
}

/** The upstream has answered both a bare array and `{ reviews: [...] }`. */
function extractReviews(payload: unknown): Review[] {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { reviews?: unknown })?.reviews)
      ? (payload as { reviews: unknown[] }).reviews
      : [];

  return candidates.filter(isReview);
}

export function summarise(reviews: Review[]): ReviewSummary {
  const count = reviews.length;
  if (count === 0) {
    return {
      reviews,
      count: 0,
      averageRating: null,
      fiveStarCount: 0,
      satisfactionRate: 0,
    };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    reviews,
    count,
    averageRating: Number((total / count).toFixed(1)),
    fiveStarCount: reviews.filter((r) => r.rating === 5).length,
    satisfactionRate: Math.round(
      (reviews.filter((r) => r.rating >= 4).length / count) * 100,
    ),
  };
}

/**
 * Fetch and summarise the reviews. Cached for an hour, and never throws — a
 * review-feed outage must not take the homepage down with it.
 */
export async function getReviewSummary(): Promise<ReviewSummary> {
  try {
    const response = await fetch(REVIEWS_ENDPOINT, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reviews: ${response.status}`);
    }

    return summarise(extractReviews(await response.json()));
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return summarise([]);
  }
}
