import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { listThreads } from "@/lib/services/messaging";
import { ThreadList } from "../../_components/thread-list";
import { AutoRefresh } from "../../_components/thread-forms";

/** The seller's Messages: every conversation, newest first (docs/messaging-model.md section 5). */
export default async function SellerMessagesPage({ params }: PageProps<"/[locale]/seller/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const threads = await listThreads(db, actor);

  return (
    <main className="flex flex-col gap-4">
      <AutoRefresh />
      <h1 className="text-xl font-semibold">Messages</h1>
      <ThreadList threads={threads} basePath="/seller/messages" />
    </main>
  );
}
