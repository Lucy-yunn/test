import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getThread } from "@/lib/services/messaging";
import { ThreadPanel } from "../../../_components/thread-view";

/** One conversation, for the seller. Opening it marks the buyer's messages as read. */
export default async function SellerThreadPage({ params }: PageProps<"/[locale]/seller/messages/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const view = await getThread(db, actor, id);
  if (!view) notFound();

  return (
    <main className="flex flex-col gap-4">
      <Link href="/seller/messages" className="text-sm underline">
        All messages
      </Link>
      <ThreadPanel view={view} path={`/seller/messages/${id}`} />
    </main>
  );
}
