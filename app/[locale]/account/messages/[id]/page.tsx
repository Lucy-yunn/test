import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getThread } from "@/lib/services/messaging";
import { ThreadPanel } from "../../../_components/thread-view";

/** One conversation, for the buyer. Opening it marks the seller's messages as read. */
export default async function BuyerThreadPage({ params }: PageProps<"/[locale]/account/messages/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();

  const view = await getThread(db, actor, id);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/account/messages" className="text-sm underline">
        All messages
      </Link>
      <ThreadPanel view={view} path={`/account/messages/${id}`} />
    </div>
  );
}
