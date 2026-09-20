import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { listThreads } from "@/lib/services/messaging";
import { ThreadList } from "../../_components/thread-list";
import { AutoRefresh } from "../../_components/thread-forms";

/** The buyer's Messages area: every conversation, newest first. */
export default async function BuyerMessagesPage({ params }: PageProps<"/[locale]/account/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();

  const threads = await listThreads(db, actor);

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh />
      <h1 className="text-2xl font-semibold">Messages</h1>
      <ThreadList threads={threads} basePath="/account/messages" />
    </div>
  );
}
