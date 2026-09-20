import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getUnreadCount } from "@/lib/services/messaging";
import { getNotificationUnreadCount } from "@/lib/services/notifications";
import { LogoutButton } from "../login/logout-button";

/**
 * Seller center shell (docs/seller-center.md section 2): no guard here (docs/auth-and-permissions.md
 * section 10). Every /seller/* page calls requireSeller(). The unread count only decorates the
 * nav: it is zero for anyone who is not a seller. Messages carries the message unread count and
 * Notifications carries the feed unread count.
 */
export default async function SellerLayout({ children }: LayoutProps<"/[locale]/seller">) {
  const actor = await getActor();
  const [unread, alerts] =
    actor?.role === "seller" ? await Promise.all([getUnreadCount(db, actor), getNotificationUnreadCount(db, actor)]) : [0, 0];
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/seller" className="font-semibold">Overview</Link>
          <Link href="/seller/orders">Orders</Link>
          <Link href="/seller/listings">Listings</Link>
          <Link href="/seller/messages">
            Messages
            {unread > 0 ? (
              <span className="ml-1 rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white" aria-label={`${unread} unread`}>
                {unread}
              </span>
            ) : null}
          </Link>
          <Link href="/seller/notifications">
            Notifications
            {alerts > 0 ? (
              <span className="ml-1 rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white" aria-label={`${alerts} unread`}>
                {alerts}
              </span>
            ) : null}
          </Link>
          <Link href="/seller/reviews">Reviews</Link>
          <Link href="/seller/credits">Credits</Link>
          <Link href="/seller/store">Store details</Link>
          <Link href="/seller/settings">Settings</Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
