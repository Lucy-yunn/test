import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getSellerProfile } from "@/lib/services/seller-profile";
import { listReviewableOrders } from "@/lib/services/reviews";
import type { SP } from "../../../browse/browse-nav";
import { ReviewForm } from "./review-form";

/**
 * The review form (docs/reviews.md section 2), opened from the seller's Reviews tab or from a
 * completed order. Signed-out visitors are sent to sign in and come back here.
 */
export default async function ReviewPage({ params, searchParams }: PageProps<"/[locale]/sellers/[id]/review">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = (await searchParams) as SP;

  const actor = await getActor();
  if (!actor) redirect(`/login?redirect=/sellers/${id}/review`);
  const profile = await getSellerProfile(db, id, actor);
  if (!profile) notFound();

  const back = (
    <Link href={`/sellers/${id}?tab=reviews`} className="text-purple-700 underline">
      Back to {profile.name}
    </Link>
  );

  if (actor.role !== "buyer") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Review {profile.name}</h1>
        <p className="mt-3">Reviews are written by buyer accounts.</p>
        <p className="mt-2 text-sm">{back}</p>
      </div>
    );
  }

  const orders = await listReviewableOrders(db, actor, id);
  const wanted = typeof sp.order === "string" ? sp.order : "";
  const defaultOrderId = orders.find((o) => o.orderId === wanted)?.orderId ?? orders[0]?.orderId ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Review {profile.name}</h1>
      <p className="mb-4 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        You can review any seller. If you bought from this seller, pick the purchase so readers can see it.
      </p>
      <ReviewForm sellerId={id} orders={orders} defaultOrderId={defaultOrderId} />
      <p className="mt-6 text-sm">{back}</p>
    </div>
  );
}
