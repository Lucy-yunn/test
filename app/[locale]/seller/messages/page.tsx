import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { listThreads } from "@/lib/services/messaging";
import { Inbox } from "../../_components/thread-list";
import { AutoRefresh } from "../../_components/thread-forms";

/**
 * The seller's Messages (docs/messaging-model.md section 5): unanswered, answered and trash,
 * laid out by latest, by buyer or by listing.
 */
export default async function SellerMessagesPage({ params, searchParams }: PageProps<"/[locale]/seller/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();
  const sp = await searchParams;

  const threads = await listThreads(db, actor);

  return (
    <main className="flex flex-col gap-4">
      <AutoRefresh />
      <h1 className="text-xl font-semibold">Messages</h1>
      <Inbox
        threads={threads}
        basePath="/seller/messages"
        viewer="seller"
        folder={typeof sp.folder === "string" ? sp.folder : undefined}
        by={typeof sp.by === "string" ? sp.by : undefined}
      />
    </main>
  );
}
