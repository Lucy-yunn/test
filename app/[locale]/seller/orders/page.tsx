import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { formatDay } from "@/lib/format-date";
import { listSellerOrders } from "@/lib/services/orders";
import { CANCELLATION_REASON_LABEL, ORDER_STATUS_LABEL } from "@/lib/order-labels";
import { OrderButtons } from "./order-buttons";

/**
 * The seller's orders (docs/order-model.md sections 3 and 11): the delivery details needed to
 * book the courier, and the buttons for this order's state. The full seller center arrives in
 * build step 13.
 */
export default async function SellerOrdersPage({ params }: PageProps<"/[locale]/seller/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const orders = await listSellerOrders(db, actor);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Orders</h1>
      {orders.length === 0 ? <p className="text-sm text-zinc-500">No orders yet.</p> : null}
      <ul className="flex flex-col gap-4">
        {orders.map((o) => {
          const pending = o.cancellation?.state === "pending";
          const a = o.address;
          return (
            <li key={o.id} className="flex flex-col gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">{o.listing.title}</p>
                  <p className="text-sm text-zinc-500">
                    {o.code} · {o.listing.code} · placed {formatDay(o.placedAt)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">€{o.itemPriceEur}</p>
                  <p className="text-zinc-500">{ORDER_STATUS_LABEL[o.status]}</p>
                </div>
              </div>

              <address className="text-sm not-italic">
                {a.recipientName} · {a.phone}
                <br />
                {a.addressLine1}
                {a.addressLine2 ? <>, {a.addressLine2}</> : null}, {a.postcode} {a.city}
              </address>
              <p className="text-xs text-zinc-500">Cash on delivery: the buyer pays you at the courier, after inspecting the part.</p>

              {pending && o.cancellation ? (
                <p className="rounded bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Cancellation requested: {CANCELLATION_REASON_LABEL[o.cancellation.reason]}
                  {o.cancellation.reasonDetail ? ` (${o.cancellation.reasonDetail})` : ""}. Auto-approves{" "}
                  {formatDay(o.cancellation.autoApproveAt)}. You cannot complete or refuse the order until it is
                  approved.
                </p>
              ) : null}
              {o.status === "cancelled" && o.cancellation ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Cancelled: {CANCELLATION_REASON_LABEL[o.cancellation.reason]}
                  {o.cancellation.reasonDetail ? ` (${o.cancellation.reasonDetail})` : ""}
                </p>
              ) : null}

              <OrderButtons orderId={o.id} status={o.status} cancellationPending={pending} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
