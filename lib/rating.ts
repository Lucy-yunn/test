/**
 * A seller's rating (docs/reviews.md section 4). Node-safe.
 *
 * The average and count are over every review that is shown, whether or not it is linked to a
 * purchase. Below 3 reviews the seller reads "New seller" instead of a number.
 */
export const MIN_REVIEWS_FOR_RATING = 3;

export interface RatingSummary {
  count: number;
  /** One decimal, halves rounding up. Null when there are no reviews. */
  average: number | null;
  /** Fewer than 3 reviews: shown as "New seller". */
  isNew: boolean;
}

/** From the total of the ratings and how many there are, which is what the database can add up. */
export function summariseTotals(sum: number, count: number): RatingSummary {
  if (count === 0) return { count, average: null, isNew: true };
  // Integer arithmetic first, so 4.85 rounds to 4.9 and not to 4.8 through floating point.
  return { count, average: Math.round((sum * 10) / count) / 10, isNew: count < MIN_REVIEWS_FOR_RATING };
}

export function summariseRatings(ratings: readonly number[]): RatingSummary {
  return summariseTotals(ratings.reduce((a, b) => a + b, 0), ratings.length);
}

/** "4.8/5 (10)", or "New seller" below 3 reviews. */
export function formatRating(summary: RatingSummary): string {
  if (summary.isNew || summary.average === null) return "New seller";
  return `${summary.average.toFixed(1)}/5 (${summary.count})`;
}
