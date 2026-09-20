import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { formatDay } from "@/lib/format-date";
import { listOrdersForStaff } from "@/lib/services/orders";
import { CANCELLATION_REASON_LABEL, ORDER_STATUS_LABEL } from "@/lib/order-labels";

/**
 * Every order, read-only (docs/order-model.md section 11). Staff cannot observe the facts
 * the statuses assert, so there are no buttons here: staff chase a slow seller themselves,
 * and the age of each open order is shown for that.
 */
export default async function AdminOrdersPage({ params }: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff();

  const orders = await listOrdersForStaff(db, actor);

  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-zinc-500">Read-only. Sellers operate their own orders.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2">Order</th>
              <th>Part</th>
              <th>Seller</th>
              <th>Buyer</th>
              <th>Status</th>
              <th>Age</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                <td className="py-2">{o.code}</td>
                <td>
                  {o.listing.title}
                  <div className="text-xs text-zinc-500">{o.listing.code} · €{o.itemPriceEur}</div>
                </td>
                <td>{o.sellerName}</td>
                <td>
                  {o.address.recipientName}
                  <div className="text-xs text-zinc-500">{o.address.phone}</div>
                </td>
                <td>
                  {ORDER_STATUS_LABEL[o.status]}
                  {o.cancellation ? (
                    <div className="text-xs text-zinc-500">
                      {o.cancellation.state === "pending" ? "Cancellation requested" : "Cancelled"}:{" "}
                      {CANCELLATION_REASON_LABEL[o.cancellation.reason]}
                      {o.cancellation.reasonDetail ? ` (${o.cancellation.reasonDetail})` : ""}
                    </div>
                  ) : null}
                </td>
                <td>{o.ageDays === null ? "—" : `${o.ageDays} d`}</td>
                <td>{formatDay(o.placedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orders.length === 0 ? <p className="text-sm text-zinc-500">No orders yet.</p> : null}
    </main>
  );
}
