import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatRating } from "@/lib/rating";
import { getSellerOverview } from "@/lib/services/seller-center";

/**
 * The seller center's landing page (docs/seller-center.md section 5): eight read-only tiles, each a
 * number, a label and a link. Every figure is a live or all-time count, never a money total.
 */
export default async function SellerOverviewPage({ params }: PageProps<"/[locale]/seller">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const o = await getSellerOverview(db, actor);
  const empty = o.activeListings === 0 && o.openOrders === 0 && o.itemsSold === 0;

  const tiles: { label: string; value: string; href: string; warn?: boolean }[] = [
    { label: "Open orders", value: String(o.openOrders), href: "/seller/orders" },
    { label: "Pending cancellations", value: String(o.pendingCancellations), href: "/seller/orders", warn: o.pendingCancellations > 0 },
    { label: "Unread messages", value: String(o.unreadMessages), href: "/seller/messages" },
    { label: "Active listings", value: String(o.activeListings), href: "/seller/listings" },
    { label: "Total favourites", value: String(o.totalFavourites), href: "/seller/listings" },
    { label: "Items sold", value: String(o.itemsSold), href: "/seller/orders?status=completed" },
    { label: "Rating", value: formatRating(o.rating), href: "/seller/reviews" },
    { label: "Credits", value: String(o.credits.balance), href: "/seller/credits", warn: o.credits.low },
  ];

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Overview</h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className={`flex h-full flex-col gap-1 rounded border p-4 ${
                t.warn ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span className="text-2xl font-semibold">{t.value}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{t.label}</span>
              {t.label === "Credits" && o.credits.low ? <span className="text-xs text-amber-800 dark:text-amber-300">Running low</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {empty ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nothing here yet. IVO staff enter and manage your listings for you.
        </p>
      ) : null}
    </main>
  );
}
