import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/format-date";
import { listSellerOrderRows, type SellerOrderRow } from "@/lib/services/seller-center";
import { ORDER_STATUS_LABEL } from "@/lib/order-labels";

const STATUSES = Object.values(OrderStatus);

function statusText(o: SellerOrderRow): string {
  return o.status === "cancelled" && o.lastReachedStatus
    ? `Cancelled, was ${ORDER_STATUS_LABEL[o.lastReachedStatus].toLowerCase()}`
    : ORDER_STATUS_LABEL[o.status];
}

function Row({ o }: { o: SellerOrderRow }) {
  return (
    <li className="flex items-center gap-4 py-3">
      {o.listing.photoUrl ? (
        <Image src={o.listing.photoUrl} alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded object-cover" />
      ) : (
        <span className="h-14 w-14 rounded bg-zinc-100 dark:bg-zinc-800" />
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/seller/orders/${o.code}`} className="font-medium underline">
          {o.listing.title}
        </Link>
        <p className="text-sm text-zinc-500">
          {o.code} · {o.buyerName}
        </p>
      </div>
      <div className="text-right text-sm">
        <p className="font-semibold">€{o.itemPriceEur}</p>
        <p className="text-zinc-500">{statusText(o)}</p>
        <p className="text-xs text-zinc-500">
          Placed {formatDay(o.placedAt)}
          {o.ageDays !== null ? ` · ${o.ageDays} d` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * The seller's orders (docs/seller-center.md section 3.1): a status filter, orders with a
 * cancellation request pinned at the top, and a row for each. Details and buttons are on the
 * order's own page.
 */
export default async function SellerOrdersPage({ params, searchParams }: PageProps<"/[locale]/seller/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);

  const rows = await listSellerOrderRows(db, actor, { status });
  const pinned = rows.filter((r) => r.cancellationPending);
  const rest = rows.filter((r) => !r.cancellationPending);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Orders</h1>
      <p className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-zinc-500">Show</span>
        <Link href="/seller/orders" className={status ? "text-purple-700 underline" : "font-semibold underline"}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/seller/orders?status=${s}`} className={status === s ? "font-semibold underline" : "text-purple-700 underline"}>
            {ORDER_STATUS_LABEL[s]}
          </Link>
        ))}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No orders yet. IVO staff enter and manage your listings, and buyers reserve them.
        </p>
      ) : null}

      {pinned.length > 0 ? (
        <section>
          <h2 className="rounded bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Cancellation requested
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {pinned.map((o) => (
              <Row key={o.id} o={o} />
            ))}
          </ul>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rest.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </ul>
      ) : null}
    </main>
  );
}
