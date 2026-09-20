import { Link } from "@/i18n/navigation";
import { LogoutButton } from "../login/logout-button";

/**
 * Seller shell: no guard here (docs/auth-and-permissions.md section 10). Every /seller/* page
 * calls requireSeller(). The full seller center is build step 13; for now it holds Orders.
 */
export default function SellerLayout({ children }: LayoutProps<"/[locale]/seller">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav className="flex gap-4 text-sm">
          <Link href="/seller" className="font-semibold">Seller</Link>
          <Link href="/seller/orders">Orders</Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
