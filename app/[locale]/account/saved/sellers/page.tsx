import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { formatDay } from "@/lib/format-date";
import { listSavedSellers, type SavedSellerCard } from "@/lib/services/saved-sellers";
import { getSellerRatings } from "@/lib/services/reviews";
import { formatRating, type RatingSummary } from "@/lib/rating";
import { Link } from "@/i18n/navigation";
import { setSellerSavedAction } from "../actions";

export default async function SavedSellersPage({ params }: PageProps<"/[locale]/account/saved/sellers">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const actor = await requireBuyer();
  const cards = await listSavedSellers(db, actor);
  const ratings = await getSellerRatings(db, cards.map((c) => c.sellerId));

  if (cards.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        You haven&rsquo;t saved any sellers yet. Use <em>Save</em> on a seller&rsquo;s page to keep them here.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-zinc-500">{cards.length} saved</p>
      {cards.map((c) => (
        <SellerCardRow key={c.sellerId} card={c} rating={ratings.get(c.sellerId)} />
      ))}
    </div>
  );
}

/** A saved seller who has lost their public profile stays in the list, greyed. */
function SellerCardRow({ card, rating }: { card: SavedSellerCard; rating?: RatingSummary }) {
  const avatar = card.avatarUrl ? (
    <Image src={card.avatarUrl} alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover" />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-200 text-xl font-semibold text-purple-900">
      {card.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );

  return (
    <article
      className={`flex items-center gap-4 border-t border-zinc-200 py-4 dark:border-zinc-800 ${card.available ? "" : "opacity-60 grayscale"}`}
    >
      {card.available ? <Link href={`/sellers/${card.sellerId}`}>{avatar}</Link> : avatar}
      <div className="min-w-0 flex-1">
        {card.available ? (
          <Link href={`/sellers/${card.sellerId}`} className="font-medium hover:underline">
            {card.name}
          </Link>
        ) : (
          <p className="font-medium">{card.name}</p>
        )}
        <p className="text-sm text-zinc-500">
          {card.city} · Last active {formatDay(card.lastActiveAt)}
        </p>
        {card.available ? (
          <p className="text-sm">
            {rating ? formatRating(rating) : "New seller"} · <span className="font-medium">{card.onShelf}</span> on the shelf
          </p>
        ) : (
          <span className="mt-1 inline-block rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            No longer available
          </span>
        )}
      </div>
      <form action={setSellerSavedAction.bind(null, card.sellerId, false)}>
        <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
          Remove
        </button>
      </form>
    </article>
  );
}
