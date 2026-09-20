import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getSellerOrder } from "@/lib/services/seller-center";
import { MessageBuyerForm } from "./message-buyer-form";

/**
 * Write to the buyer of one of your orders (docs/seller-center.md section 3.3), for example
 * before approving a cancellation. If a conversation already exists you go straight to it.
 */
export default async function MessageBuyerPage({ params }: PageProps<"/[locale]/seller/orders/[code]/message">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const order = await getSellerOrder(db, actor, decodeURIComponent(code));
  if (!order) notFound();
  if (order.threadId) redirect(`/seller/messages/${order.threadId}`);

  return (
    <main className="flex flex-col gap-4">
      <Link href={`/seller/orders/${order.code}`} className="text-sm underline">
        Back to the order
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Message the buyer</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          About order {order.code}: {order.listing.title}
        </p>
      </div>
      <MessageBuyerForm orderId={order.id} />
    </main>
  );
}
