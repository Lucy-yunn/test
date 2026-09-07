import { Link } from "@/i18n/navigation";
import { LogoutButton } from "../login/logout-button";

/**
 * Admin shell — NO guard here (docs/auth-and-permissions.md §10). Every
 * /admin/* page calls requireStaff(). English-only, still under [locale].
 */
export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin" className="font-semibold">Admin</Link>
          <Link href="/admin/sellers">Sellers</Link>
          <Link href="/admin/buyers">Buyers</Link>
          <Link href="/admin/catalogue">Vehicle catalogue</Link>
          <Link href="/admin/parts">Parts</Link>
          <Link href="/admin/listings">Listings</Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
