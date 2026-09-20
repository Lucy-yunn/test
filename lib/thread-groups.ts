/**
 * Grouping a person's conversations for the inbox. Node-safe.
 *
 * A seller groups by buyer (what one buyer asked about, to combine a delivery) or by listing
 * (every buyer asking about one part, to compare them). A buyer groups by seller or by listing.
 * Direct conversations have no listing, so they share one group of their own at the end.
 */
export interface GroupableThread {
  id: string;
  otherPartyId: string;
  otherPartyName: string;
  listing: { code: string; title: string } | null;
  lastMessageAt: Date;
  unread: number;
}

export type GroupBy = "person" | "listing";

export interface ThreadGroup<T extends GroupableThread> {
  key: string;
  title: string;
  threads: T[];
  unread: number;
  lastMessageAt: Date;
}

const DIRECT_KEY = "direct";

export function groupThreads<T extends GroupableThread>(threads: readonly T[], by: GroupBy): ThreadGroup<T>[] {
  const groups = new Map<string, ThreadGroup<T>>();
  for (const t of threads) {
    const [key, title] =
      by === "person"
        ? [t.otherPartyId, t.otherPartyName]
        : t.listing
          ? [t.listing.code, t.listing.title]
          : [DIRECT_KEY, "Direct conversations"];
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, title, threads: [], unread: 0, lastMessageAt: t.lastMessageAt }));
    g.threads.push(t);
    g.unread += t.unread;
    if (t.lastMessageAt > g.lastMessageAt) g.lastMessageAt = t.lastMessageAt;
  }
  const newestFirst = (a: { lastMessageAt: Date }, b: { lastMessageAt: Date }) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  const all = [...groups.values()];
  for (const g of all) g.threads.sort(newestFirst);
  // Grouped by listing, the direct conversations always come last, whatever their date.
  const isDirect = (g: ThreadGroup<T>) => by === "listing" && g.key === DIRECT_KEY;
  return [...all.filter((g) => !isDirect(g)).sort(newestFirst), ...all.filter(isDirect)];
}

/** The inbox folders. A seller has unanswered, answered and trash; a buyer has inbox and trash. */
export type Folder = "unanswered" | "answered" | "inbox" | "trash";

export function inFolder(t: { trashed: boolean; needsReply: boolean }, folder: Folder): boolean {
  if (folder === "trash") return t.trashed;
  if (t.trashed) return false;
  if (folder === "unanswered") return t.needsReply;
  if (folder === "answered") return !t.needsReply;
  return true;
}

/** The folder named in the address, or the first one offered when it is missing or not one of them. */
export function parseFolder<F extends Folder>(value: string | undefined, allowed: readonly F[]): F {
  return allowed.find((f) => f === value) ?? allowed[0];
}
