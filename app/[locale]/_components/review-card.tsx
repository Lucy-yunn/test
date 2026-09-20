import { formatDay } from "@/lib/format-date";
import type { ReviewView } from "@/lib/services/reviews";
import { Stars } from "./stars";

/**
 * One review (docs/reviews.md section 3): the reviewer's name, the stars, the context label
 * (the purchased part as plain text, or "No purchase"), the text, and the seller's reply
 * indented beneath it.
 */
export function ReviewCard({ review }: { review: ReviewView }) {
  return (
    <article className="border-t border-zinc-200 py-4 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-200 text-sm font-semibold text-purple-900">
          {review.authorName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div>
          <p className="text-sm font-medium">{review.authorName}</p>
          <p className="text-xs text-zinc-500">{formatDay(review.createdAt)}</p>
        </div>
        <div className="ml-auto text-right">
          <Stars rating={review.rating} />
          <span className="ml-1 text-sm">{review.rating}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{review.context}</p>
      {review.body ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{review.body}</p> : null}
      {review.reply ? (
        <div className="ml-8 mt-3 rounded border-l-2 border-purple-300 bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
          <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">Seller reply</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{review.reply.body}</p>
        </div>
      ) : null}
    </article>
  );
}
