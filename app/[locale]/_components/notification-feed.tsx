import { Link } from "@/i18n/navigation";
import type { NotificationView } from "@/lib/services/notifications";
import type { NotificationType } from "@prisma/client";
import { markAllReadAction } from "./notification-actions";

const ICON: Record<NotificationType, string> = {
  order_placed: "🛒",
  order_confirmed: "✅",
  order_completed: "🎉",
  order_refused: "↩️",
  order_cancelled: "✖️",
  cancellation_requested: "❓",
  cancellation_approved: "✔️",
  review_received: "⭐",
  review_replied: "💬",
  credits_low: "⚠️",
  credits_empty: "⛔",
};

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "yesterday". */
function ago(date: Date, now: Date): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/**
 * The notification feed (docs/notifications.md section 5): an icon by type, one line, the time
 * and a link to what it is about. There is a Mark all as read and no way to delete a single row.
 */
export function NotificationFeed({ items, path }: { items: NotificationView[]; path: string }) {
  const now = new Date();
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="flex flex-col gap-3">
      {unread > 0 ? (
        <form action={markAllReadAction}>
          <input type="hidden" name="path" value={path} />
          <button className="rounded border px-3 py-1 text-sm">Mark all as read</button>
        </form>
      ) : null}
      {items.length === 0 ? <p className="text-sm text-zinc-500">No notifications yet.</p> : null}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((n) => (
          <li key={n.id}>
            <Link href={n.href} className="flex items-start gap-3 py-3">
              <span aria-hidden className="text-lg">
                {ICON[n.type]}
              </span>
              <span className="min-w-0 flex-1">
                <span className={n.readAt ? "" : "font-semibold"}>{n.text}</span>
                <span className="block text-xs text-zinc-500">{ago(n.createdAt, now)}</span>
              </span>
              {n.readAt ? null : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-700" aria-label="Unread" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
