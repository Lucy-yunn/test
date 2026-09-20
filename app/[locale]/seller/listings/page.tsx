import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { ListingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/format-date";
import { getCategoryBreakdown, listSellerListings } from "@/lib/services/seller-center";
import { LISTING_STATUS_LABEL } from "@/lib/order-labels";

const STATUSES = Object.values(ListingStatus);

/**
 * The seller's listings in all six statuses (docs/seller-center.md section 6): a status filter,
 * the category breakdown of what is on the shelf, and a row for each listing. Staff enter and
 * change listings; the seller only reads them.
 */
export default async function SellerListingsPage({ params, searchParams }: PageProps<"/[locale]/seller/listings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);

  const [rows, breakdown, everything] = await Promise.all([
    listSellerListings(db, actor, { status }),
    getCategoryBreakdown(db, actor),
    status ? listSellerListings(db, actor, {}) : null,
  ]);
  const hasAny = (everything ?? rows).length > 0;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Listings</h1>

      {!hasAny ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">IVO is preparing your listings.</p>
      ) : (
        <>
          {breakdown.length > 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              On the shelf: {breakdown.map((b) => `${b.groupName} ${b.count}`).join(" · ")}
            </p>
          ) : null}
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-zinc-500">Show</span>
            <Link href="/seller/listings" className={status ? "text-purple-700 underline" : "font-semibold underline"}>
              All
            </Link>
            {STATUSES.map((s) => (
              <Link key={s} href={`/seller/listings?status=${s}`} className={status === s ? "font-semibold underline" : "text-purple-700 underline"}>
                {LISTING_STATUS_LABEL[s]}
              </Link>
            ))}
          </p>
          {rows.length === 0 ? <p className="text-sm text-zinc-500">No listings with that status.</p> : null}
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((l) => (
              <li key={l.code} className="flex items-center gap-4 py-3">
                {l.photoUrl ? (
                  <Image src={l.photoUrl} alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded object-cover" />
                ) : (
                  <span className="h-14 w-14 rounded bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/seller/listings/${l.code}`} className="font-medium underline">
                    {l.title}
                  </Link>
                  <p className="text-sm text-zinc-500">
                    {l.code} · {l.categoryName}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">€{l.priceEur}</p>
                  <p className="text-zinc-500">{LISTING_STATUS_LABEL[l.status]}</p>
                  <p className="text-xs text-zinc-500">
                    {l.favourites} {l.favourites === 1 ? "favourite" : "favourites"} · published {formatDay(l.publishedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
