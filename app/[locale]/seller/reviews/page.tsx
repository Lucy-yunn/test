import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { getSellerRating, listReviewsForSeller } from "@/lib/services/reviews";
import { markReviewsRead } from "@/lib/services/notifications";
import { formatRating } from "@/lib/rating";
import { ReviewCard } from "../../_components/review-card";
import { ReplyToReviewForm } from "./reply-form";

/** The seller's reviews with a reply box for each one that has no reply yet (docs/reviews.md section 6). */
export default async function SellerReviewsPage({ params }: PageProps<"/[locale]/seller/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const [reviews, rating] = await Promise.all([listReviewsForSeller(db, actor), getSellerRating(db, actor.sellerId!)]);
  await markReviewsRead(db, actor); // opening your reviews clears the "new review" notices

  return (
    <main className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Reviews</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatRating(rating)}</p>
      {reviews.length === 0 ? <p className="text-sm text-zinc-500">No reviews yet.</p> : null}
      {reviews.map((r) => (
        <div key={r.id}>
          <ReviewCard review={r} />
          {r.reply ? null : <ReplyToReviewForm reviewId={r.id} />}
        </div>
      ))}
    </main>
  );
}
