import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getUnreadCount } from "@/lib/services/messaging";
import { getNotificationUnreadCount } from "@/lib/services/notifications";

/** "My account": where the header's account link leads, with a way into each buyer area. */
export default async function AccountHomePage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();

  const [messages, notifications] = await Promise.all([getUnreadCount(db, actor), getNotificationUnreadCount(db, actor)]);

  const sections: { href: string; title: string; note: string; unread?: number }[] = [
    { href: "/account/orders", title: "My orders", note: "Your reservations and their status" },
    { href: "/account/saved", title: "Saved", note: "Parts and sellers you saved" },
    { href: "/account/messages", title: "Messages", note: "Conversations with sellers", unread: messages },
    { href: "/account/notifications", title: "Notifications", note: "Updates on your orders and reviews", unread: notifications },
    { href: "/account/settings", title: "Settings", note: "Your name, delivery address and password" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">My account</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full flex-col gap-1 rounded border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              <span className="flex items-center gap-2 font-medium">
                {s.title}
                {s.unread ? (
                  <span className="rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white" aria-label={`${s.unread} unread`}>
                    {s.unread}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{s.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
