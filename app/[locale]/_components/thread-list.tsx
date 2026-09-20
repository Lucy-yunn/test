import { Link } from "@/i18n/navigation";
import type { ThreadListItem } from "@/lib/services/messaging";
import { groupThreads, inFolder, parseFolder, type Folder, type GroupBy } from "@/lib/thread-groups";

/** The folders each side sees. The first is the one shown when the address names none. */
const FOLDERS = {
  seller: [
    { key: "unanswered", label: "Unanswered" },
    { key: "answered", label: "Answered" },
    { key: "trash", label: "Trash" },
  ],
  buyer: [
    { key: "inbox", label: "Inbox" },
    { key: "trash", label: "Trash" },
  ],
} as const satisfies Record<string, readonly { key: Folder; label: string }[]>;

type Viewer = keyof typeof FOLDERS;
type Grouping = "latest" | GroupBy;

function parseGrouping(value: string | undefined): Grouping {
  return value === "person" || value === "listing" ? value : "latest";
}

/** A row's title: who, and what about. */
function rowTitle(t: ThreadListItem): string {
  return `${t.otherPartyName} · ${t.listing?.title ?? "Direct conversation"}`;
}

function Row({ t, basePath }: { t: ThreadListItem; basePath: string }) {
  return (
    <li className="py-3">
      <Link href={`${basePath}/${t.id}`} className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={t.unread > 0 ? "font-semibold" : "font-medium"}>{rowTitle(t)}</p>
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
  );
}

const tabClass = (active: boolean) =>
  `px-4 py-2 text-center ${
    active
      ? "border-b-2 border-purple-700 text-purple-800 dark:text-purple-300"
      : "text-zinc-600 hover:text-purple-800 dark:text-zinc-400 dark:hover:text-purple-300"
  }`;

/**
 * A person's conversations: folders (a seller's unanswered, answered and trash; a buyer's inbox
 * and trash) and a choice of how to lay them out. A seller can group by buyer, to see everything
 * one buyer asked about, or by listing, to see every buyer asking about one part. A buyer can
 * group by seller or by listing.
 */
export function Inbox({
  threads,
  basePath,
  viewer,
  folder: folderParam,
  by: byParam,
}: {
  threads: ThreadListItem[];
  basePath: string;
  viewer: Viewer;
  folder: string | undefined;
  by: string | undefined;
}) {
  const folders = FOLDERS[viewer];
  const folder = parseFolder(folderParam, folders.map((f) => f.key));
  const by = parseGrouping(byParam);
  const inThis = threads.filter((t) => inFolder(t, folder));
  const href = (f: Folder, g: Grouping) => `${basePath}?folder=${f}${g === "latest" ? "" : `&by=${g}`}`;

  const layouts: { key: Grouping; label: string }[] = [
    { key: "latest", label: "Latest" },
    { key: "person", label: viewer === "seller" ? "By buyer" : "By seller" },
    { key: "listing", label: "By listing" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Folders" className="flex border-b border-zinc-200 text-sm font-medium dark:border-zinc-800">
        {folders.map((f) => {
          const count = threads.filter((t) => inFolder(t, f.key)).length;
          const unread = threads.filter((t) => inFolder(t, f.key)).reduce((n, t) => n + t.unread, 0);
          return (
            <Link key={f.key} href={href(f.key, by)} aria-current={f.key === folder ? "page" : undefined} className={`flex-1 ${tabClass(f.key === folder)}`}>
              {f.label} ({count})
              {unread > 0 ? <span className="ml-1 rounded-full bg-purple-700 px-1.5 py-0.5 text-xs text-white">{unread}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 text-sm" aria-label="Layout" role="group">
        {layouts.map((l) => (
          <Link
            key={l.key}
            href={href(folder, l.key)}
            aria-current={l.key === by ? "true" : undefined}
            className={`rounded-full border px-3 py-1 ${
              l.key === by ? "border-purple-700 bg-purple-50 text-purple-900 dark:bg-purple-950 dark:text-purple-200" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {inThis.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {threads.length === 0 ? "No conversations yet." : folder === "trash" ? "The trash is empty." : "Nothing here."}
        </p>
      ) : by === "latest" ? (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {inThis.map((t) => (
            <Row key={t.id} t={t} basePath={basePath} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-5">
          {groupThreads(inThis, by).map((g) => (
            <section key={g.key}>
              <h2 className="flex items-center gap-2 border-b border-zinc-200 pb-1 text-sm font-semibold dark:border-zinc-800">
                {g.title}
                <span className="font-normal text-zinc-500">
                  {g.threads.length} {g.threads.length === 1 ? "conversation" : "conversations"}
                </span>
                {g.unread > 0 ? <span className="rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white">{g.unread}</span> : null}
              </h2>
              <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {g.threads.map((t) => (
                  <Row key={t.id} t={t} basePath={basePath} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
