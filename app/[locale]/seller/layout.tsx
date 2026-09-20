import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getUnreadCount } from "@/lib/services/messaging";
import { LogoutButton } from "../login/logout-button";

/**
 * Seller shell: no guard here (docs/auth-and-permissions.md section 10). Every /seller/* page
 * calls requireSeller(). The full seller center is build step 13; for now it holds Orders and
 * Messages. The unread count only decorates the nav: it is zero for anyone who is not a seller.
 */
export default async function SellerLayout({ children }: LayoutProps<"/[locale]/seller">) {
  const actor = await getActor();
  const unread = actor?.role === "seller" ? await getUnreadCount(db, actor) : 0;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav className="flex gap-4 text-sm">
          <Link href="/seller" className="font-semibold">Seller</Link>
          <Link href="/seller/orders">Orders</Link>
          <Link href="/seller/messages">
            Messages
            {unread > 0 ? (
              <span className="ml-1 rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white" aria-label={`${unread} unread`}>
                {unread}
              </span>
            ) : null}
          </Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
