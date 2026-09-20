import { Link } from "@/i18n/navigation";
import type { ThreadListItem } from "@/lib/services/messaging";

/** A person's conversations, most recently active first, with an unread count on each. */
export function ThreadList({ threads, basePath }: { threads: ThreadListItem[]; basePath: string }) {
  if (threads.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No conversations yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {threads.map((t) => (
        <li key={t.id} className="py-3">
          <Link href={`${basePath}/${t.id}`} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={t.unread > 0 ? "font-semibold" : "font-medium"}>
                {t.otherPartyName} · {t.listing.title}
              </p>
              {t.lastMessage ? (
                <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {t.lastMessage.from === "me" ? "You: " : t.lastMessage.from === "support" ? "IVO Support: " : ""}
                  {t.lastMessage.body}
                </p>
              ) : null}
              {t.locked ? <p className="text-xs text-zinc-500">Closed by IVO</p> : null}
            </div>
            {t.unread > 0 ? (
              <span className="shrink-0 rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white" aria-label={`${t.unread} unread`}>
                {t.unread}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
