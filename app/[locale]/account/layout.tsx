import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LogoutButton } from "../login/logout-button";

/**
 * Shell only — NO auth guard here (docs/auth-and-permissions.md §10: layouts
 * don't re-run on navigation). Each /account/* page calls requireBuyer().
 */
export default async function AccountLayout({ children }: LayoutProps<"/[locale]/account">) {
  const t = await getTranslations("Account");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav className="flex gap-4 text-sm">
          <Link href="/account/orders">{t("orders")}</Link>
          <Link href="/account/favourites">{t("favourites")}</Link>
          <Link href="/account/messages">{t("messages")}</Link>
          <Link href="/account/settings">{t("settings")}</Link>
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
