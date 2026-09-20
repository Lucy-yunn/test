import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/format-date";
import { getBuyerOrder } from "@/lib/services/orders";
import { CANCELLATION_REASON_LABEL, ORDER_STATUS_LABEL, ORDER_STEP_NOTE } from "@/lib/order-labels";
import { SellerContactView } from "@/app/[locale]/(shop)/_components/seller-contact";
import { OrderTracker } from "../../../_components/order-tracker";
import { CancelForm } from "./cancel-form";

/** The buyer's order page (docs/order-model.md section 7). Reachable only by the buyer who placed it. */
export default async function OrderPage({ params }: PageProps<"/[locale]/account/orders/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();

  const order = await getBuyerOrder(db, actor, decodeURIComponent(code));
  if (!order) notFound();

  const request = order.cancellation;
  const pending = request?.state === "pending";
  const canCancel = !request && (order.status === "placed" || order.status === "confirmed");
  const a = order.address;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-zinc-500">Order {order.code}</p>
        <h1 className="text-2xl font-semibold">{order.listing.title}</h1>
        <p className="text-sm text-zinc-500">Placed {formatDay(order.placedAt)}</p>
      </div>

      <section className="flex flex-col gap-2">
        <OrderTracker status={order.status} lastReachedStatus={order.lastReachedStatus} />
        {ORDER_STEP_NOTE[order.status] ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{ORDER_STEP_NOTE[order.status]}</p>
        ) : null}
        {pending ? (
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Cancellation requested. Auto-approves {formatDay(request.autoApproveAt)}.
          </p>
        ) : null}
        {order.status === "cancelled" && request ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Reason: {CANCELLATION_REASON_LABEL[request.reason]}
            {request.reasonDetail ? ` — ${request.reasonDetail}` : ""}
          </p>
        ) : null}
        {order.status === "refused" && order.refusalNote ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Seller note: {order.refusalNote}</p>
        ) : null}
      </section>

      <section className="flex items-center gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        {order.listing.photoUrl ? (
          <Image src={order.listing.photoUrl} alt="" width={80} height={80} unoptimized className="h-20 w-20 rounded object-cover" />
        ) : null}
        <div>
          <Link href={`/listing/${order.listing.code}`} className="font-medium underline">
            {order.listing.title}
          </Link>
          <p className="text-lg font-semibold">€{order.itemPriceEur}</p>
          <p className="text-sm text-zinc-500">{ORDER_STATUS_LABEL[order.status]}</p>
        </div>
      </section>

      <p className="rounded bg-purple-50 p-3 text-sm dark:bg-purple-950">
        <strong>Cash on delivery.</strong> You pay the seller after inspecting the part at the courier. The price shown
        excludes the courier fee, which you pay to the courier.
      </p>

      <section>
        <h2 className="text-lg font-semibold">Delivery address</h2>
        <address className="mt-1 text-sm not-italic">
          {a.recipientName}
          <br />
          {a.addressLine1}
          {a.addressLine2 ? <>, {a.addressLine2}</> : null}
          <br />
          {a.postcode} {a.city}, {a.country === "BG" ? "Bulgaria" : a.country}
          <br />
          {a.phone}
        </address>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Seller</h2>
        <div className="mt-1 text-sm">
          {order.seller.available ? (
            <Link href={`/sellers/${order.seller.id}`} className="font-medium underline">
              {order.seller.name}
            </Link>
          ) : (
            <span className="font-medium">{order.seller.name}</span>
          )}
          <p className="text-zinc-600 dark:text-zinc-400">{order.seller.city}</p>
          <div className="mt-1">
            <SellerContactView
              contact={order.seller.contact}
              signInHref="/login"
              signInClassName="inline-block rounded border px-3 py-1"
              emptyNote="No phone on file"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {order.status === "completed" && !order.reviewed && order.seller.available ? (
          <Link href={`/sellers/${order.seller.id}/review?order=${order.id}`} className="w-fit rounded bg-purple-700 px-4 py-2 text-sm text-white">
            Leave a review
          </Link>
        ) : null}
        {canCancel ? <CancelForm orderId={order.id} orderCode={order.code} instant={order.status === "placed"} /> : null}
        {order.seller.available ? (
          <Link href={`/listing/${order.listing.code}/message`} className="w-fit rounded border px-4 py-2 text-sm">
            Message seller
          </Link>
        ) : (
          <p className="text-xs text-zinc-500">Messaging isn&rsquo;t available for this seller.</p>
        )}
      </section>
    </div>
  );
}
