import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { ThreadView } from "@/lib/services/messaging";
import { AutoRefresh, ReplyForm, ReportForm } from "./thread-forms";

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * One conversation, for the buyer or the seller (docs/messaging-model.md sections 3 to 5):
 * the pinned listing header with its badge, the messages, and the reply box. Support messages
 * are shown as IVO Support and never as the other person.
 */
export function ThreadPanel({ view, path }: { view: ThreadView; path: string }) {
  const onSale = view.listing.status === "published" || view.listing.status === "reserved";
  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh />

      <div className="flex items-center gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        {view.listing.photoUrl ? (
          <Image src={view.listing.photoUrl} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          {onSale ? (
            <Link href={`/listing/${view.listing.code}`} className="font-medium underline">
              {view.listing.title}
            </Link>
          ) : (
            <span className="font-medium">{view.listing.title}</span>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">€{view.listing.priceEur}</p>
          {view.listing.badge ? (
            <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {view.listing.badge}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-zinc-500">With {view.otherPartyName}</p>
      </div>

      <ol className="flex flex-col gap-3" aria-label="Messages">
        {view.messages.map((m) => (
          <li
            key={m.id}
            className={`max-w-[85%] rounded px-3 py-2 text-sm ${
              m.from === "me"
                ? "self-end bg-purple-100 dark:bg-purple-950"
                : m.from === "support"
                  ? "self-center border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                  : "self-start bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {m.from === "support" ? <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">IVO Support</p> : null}
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <p className="mt-1 text-xs text-zinc-500">{WHEN.format(m.sentAt)}</p>
          </li>
        ))}
      </ol>

      {view.state === "locked" ? (
        <p className="rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-800">This conversation was closed by IVO.</p>
      ) : view.state === "blocked" ? (
        <p className="rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          Messaging has been turned off for your account, so you can read this conversation but not reply.
        </p>
      ) : (
        <ReplyForm threadId={view.id} path={path} />
      )}

      <ReportForm threadId={view.id} path={path} alreadyReported={view.reportedByMe} />
    </div>
  );
}
