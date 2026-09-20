import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/format-date";
import { listThreadsForStaff } from "@/lib/services/messaging";

/** Every conversation, newest first, with the ones that have an open report flagged. */
export default async function AdminThreadsPage({ params }: PageProps<"/[locale]/admin/threads">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff();

  const threads = await listThreadsForStaff(db, actor);
  const flagged = threads.filter((t) => t.openReports > 0).length;

  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Conversations</h1>
        <p className="text-sm text-zinc-500">
          {flagged > 0 ? `${flagged} with an open report. ` : "No open reports. "}Conversations are not private from staff.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2">Part</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>Messages</th>
              <th>Last message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2">
                  <Link href={`/admin/threads/${t.id}`} className="underline">
                    {t.listing?.title ?? "Direct conversation"}
                  </Link>
                  {t.listing ? <div className="text-xs text-zinc-500">{t.listing.code}</div> : null}
                </td>
                <td>{t.buyerName}</td>
                <td>{t.sellerName}</td>
                <td>{t.messageCount}</td>
                <td>{formatDay(t.lastMessageAt)}</td>
                <td>
                  {t.openReports > 0 ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                      {t.openReports} reported
                    </span>
                  ) : null}
                  {t.locked ? <span className="ml-1 text-xs text-zinc-500">Locked</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {threads.length === 0 ? <p className="text-sm text-zinc-500">No conversations yet.</p> : null}
    </main>
  );
}
