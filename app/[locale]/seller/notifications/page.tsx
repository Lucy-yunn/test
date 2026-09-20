import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { listNotifications } from "@/lib/services/notifications";
import { NotificationFeed } from "../../_components/notification-feed";

/** The seller's notifications, newest first (docs/notifications.md section 5). */
export default async function SellerNotificationsPage({ params }: PageProps<"/[locale]/seller/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const items = await listNotifications(db, actor);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <NotificationFeed items={items} path="/seller/notifications" />
    </main>
  );
}
