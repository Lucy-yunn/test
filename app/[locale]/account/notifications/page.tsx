import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { listNotifications } from "@/lib/services/notifications";
import { NotificationFeed } from "../../_components/notification-feed";

/** The buyer's notifications, newest first. The bell in the header links here. */
export default async function BuyerNotificationsPage({ params }: PageProps<"/[locale]/account/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireBuyer();

  const items = await listNotifications(db, actor);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <NotificationFeed items={items} path="/account/notifications" />
    </div>
  );
}
