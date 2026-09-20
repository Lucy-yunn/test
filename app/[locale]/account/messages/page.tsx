import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { listThreads } from "@/lib/services/messaging";
import { Inbox } from "../../_components/thread-list";
import { AutoRefresh } from "../../_components/thread-forms";

/** The buyer's Messages area: an inbox and a trash, laid out by latest, by seller or by listing. */
export default async function BuyerMessagesPage({ params, searchParams }: PageProps<"/[locale]/account/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();
  const sp = await searchParams;

  const threads = await listThreads(db, actor);

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh />
      <h1 className="text-2xl font-semibold">Messages</h1>
      <Inbox
        threads={threads}
        basePath="/account/messages"
        viewer="buyer"
        folder={typeof sp.folder === "string" ? sp.folder : undefined}
        by={typeof sp.by === "string" ? sp.by : undefined}
      />
    </div>
  );
}
