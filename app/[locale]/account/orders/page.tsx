import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/format-date";
import { listBuyerOrders } from "@/lib/services/orders";
import { ORDER_STATUS_LABEL } from "@/lib/order-labels";

/** The buyer's orders, newest first. */
export default async function OrdersPage({ params }: PageProps<"/[locale]/account/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();

  const orders = await listBuyerOrders(db, actor);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">My orders</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You have no orders yet. <Link href="/browse" className="underline">Find a part</Link>.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <Link href={`/account/orders/${o.code}`} className="font-medium underline">
                  {o.listing.title}
                </Link>
                <p className="text-sm text-zinc-500">
                  {o.code} · placed {formatDay(o.placedAt)}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">€{o.itemPriceEur}</p>
                <p className="text-zinc-500">{ORDER_STATUS_LABEL[o.status]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
