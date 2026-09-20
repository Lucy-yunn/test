import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/format-date";
import { getSellerOrder } from "@/lib/services/seller-center";
import { CANCELLATION_REASON_LABEL, ORDER_STATUS_LABEL } from "@/lib/order-labels";
import { OrderTracker } from "../../../_components/order-tracker";
import { OrderButtons } from "../order-buttons";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used, good",
  needs_repair: "Needs repair",
};

/** One order in full (docs/seller-center.md section 3.2 and 3.3): delivery, payment reminder, item, tracker, cancellation and the seller's buttons. */
export default async function SellerOrderPage({ params }: PageProps<"/[locale]/seller/orders/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const o = await getSellerOrder(db, actor, decodeURIComponent(code));
  if (!o) notFound();

  const a = o.address;
  const pending = o.cancellation?.state === "pending";
  const stamps = [
    ["Placed", o.placedAt],
    ["Confirmed", o.confirmedAt],
    ["Completed", o.completedAt],
    ["Refused", o.refusedAt],
    ["Cancelled", o.cancelledAt],
  ] as const;

  return (
    <main className="flex flex-col gap-6">
      <Link href="/seller/orders" className="text-sm underline">
        All orders
      </Link>
      <div>
        <p className="text-sm text-zinc-500">Order {o.code}</p>
        <h1 className="text-xl font-semibold">{o.listing.title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {ORDER_STATUS_LABEL[o.status]} · €{o.itemPriceEur}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <OrderTracker status={o.status} lastReachedStatus={o.lastReachedStatus} />
        <ul className="text-xs text-zinc-500">
          {stamps.filter(([, at]) => at).map(([label, at]) => (
            <li key={label}>
              {label} {formatDay(at)}
            </li>
          ))}
        </ul>
        {o.status === "refused" && o.refusalNote ? <p className="text-sm">Your note: {o.refusalNote}</p> : null}
      </section>

      <p className="rounded bg-purple-50 p-3 text-sm dark:bg-purple-950">
        <strong>Cash on delivery:</strong> the buyer pays you after inspecting the part.
      </p>

      <section>
        <h2 className="text-lg font-semibold">Delivery</h2>
        <address className="mt-1 text-sm not-italic">
          {a.recipientName}
          <br />
          {a.addressLine1}
          {a.addressLine2 ? <>, {a.addressLine2}</> : null}
          <br />
          {a.postcode} {a.city}, {a.country === "BG" ? "Bulgaria" : a.country}
          <br />
          Phone: <a href={`tel:${a.phone.replace(/\s+/g, "")}`} className="text-purple-700 underline">{a.phone}</a>
        </address>
      </section>

      <section className="flex items-center gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        {o.listing.photoUrl ? (
          <Image src={o.listing.photoUrl} alt="" width={80} height={80} unoptimized className="h-20 w-20 rounded object-cover" />
        ) : null}
        <div className="text-sm">
          <Link href={`/seller/listings/${o.listing.code}`} className="font-medium underline">
            {o.part.name}
          </Link>
          <p className="text-zinc-600 dark:text-zinc-400">
            {CONDITION_LABEL[o.listing.condition] ?? o.listing.condition} · {o.part.groupName} › {o.part.categoryName}
          </p>
          <p className="text-zinc-500">{o.listing.code}</p>
        </div>
      </section>

      {o.cancellation ? (
        <section className={`rounded p-3 text-sm ${pending ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-zinc-50 dark:bg-zinc-900"}`}>
          <h2 className="font-semibold">{pending ? "Cancellation requested" : "Cancellation"}</h2>
          <p>
            Reason: {CANCELLATION_REASON_LABEL[o.cancellation.reason]}
            {o.cancellation.reasonDetail ? ` (${o.cancellation.reasonDetail})` : ""}
          </p>
          {pending ? (
            <p>
              Auto-approves {formatDay(o.cancellation.autoApproveAt)}. You cannot complete or refuse the order until it is
              approved. Approving is immediate and cannot be undone. There is no way to reject it: if you want the order to go ahead,
              talk to the buyer first.
            </p>
          ) : (
            <p>Approved {formatDay(o.cancellation.resolvedAt)}.</p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <OrderButtons orderId={o.id} status={o.status} cancellationPending={pending} />
        {o.threadId ? (
          <Link href={`/seller/messages/${o.threadId}`} className="w-fit rounded border px-4 py-2 text-sm">
            {pending ? "Message the buyer first" : "Message buyer"}
          </Link>
        ) : (
          <Link href={`/seller/orders/${o.code}/message`} className="w-fit rounded border px-4 py-2 text-sm">
            {pending ? "Message the buyer first" : "Message buyer"}
          </Link>
        )}
      </section>
    </main>
  );
}
