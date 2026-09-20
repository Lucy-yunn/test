import { db } from "@/lib/db";
import type { Actor } from "@/lib/dal/actor";
import { Link } from "@/i18n/navigation";
import { listSellerReviews, type ReviewSort } from "@/lib/services/reviews";
import { markReviewsRead } from "@/lib/services/notifications";
import { ReviewCard } from "../../../_components/review-card";

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest" },
  { value: "lowest", label: "Lowest" },
];

export function parseReviewSort(value: string | undefined): ReviewSort {
  return SORTS.find((s) => s.value === value)?.value ?? "newest";
}

/**
 * The Reviews tab (docs/reviews.md sections 2 to 5): the total and average, a sort, the
 * Leave a review button, and every review that has not been hidden.
 */
export async function ReviewsTab({ sellerId, sort, actor }: { sellerId: string; sort: ReviewSort; actor: Actor | null }) {
  const { summary, reviews } = await listSellerReviews(db, sellerId, sort);
  // A buyer who opens the seller's Reviews has seen the seller's replies to their own reviews.
  if (actor?.role === "buyer") await markReviewsRead(db, actor, sellerId);
  const reviewHref = `/sellers/${sellerId}/review`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Reviews</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {summary.count === 0
              ? "No reviews yet."
              : `${summary.count} ${summary.count === 1 ? "review" : "reviews"} · average ${summary.average?.toFixed(1)}/5`}
            {summary.isNew ? " · New seller" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {summary.count > 1 ? (
            <p className="flex items-center gap-2">
              <span className="text-zinc-500">Sort by</span>
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={`/sellers/${sellerId}?tab=reviews&sort=${s.value}`}
                  className={sort === s.value ? "font-semibold underline" : "text-purple-700 underline"}
                >
                  {s.label}
                </Link>
              ))}
            </p>
          ) : null}
          {actor && actor.role !== "buyer" ? (
            <button type="button" disabled title="Reviews are written by buyer accounts" className="rounded border px-3 py-1 opacity-60">
              Leave a review
            </button>
          ) : (
            <Link
              href={actor ? reviewHref : `/login?redirect=${reviewHref}`}
              className="rounded bg-purple-700 px-3 py-1 text-white"
            >
              Leave a review
            </Link>
          )}
        </div>
      </div>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  );
}
