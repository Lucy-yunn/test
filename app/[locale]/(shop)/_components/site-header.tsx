import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/lib/dal/session";
import { LocaleSelect } from "./locale-select";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const actor = await getActor();

  return (
    <header className="bg-purple-800 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <nav className="flex gap-4">
          <Link href="/info/contacts">{t("contacts")}</Link>
          <Link href="/info/help">{t("help")}</Link>
          <Link href="/info/sell" className="text-amber-300">{t("sell")}</Link>
          <Link href="/info/sell">{t("joinUs")}</Link>
        </nav>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">
            {t("deliveryTo", { place: "Bulgaria, Aytos" })}
          </span>
          <LocaleSelect />
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-3">
        <Link href="/" className="text-2xl font-bold tracking-tight">IVO</Link>
        <div className="flex items-center gap-4 text-sm">
          {actor?.role === "buyer" ? (
            <>
              <Link href="/account/messages">{t("messages")}</Link>
              <Link href="/account/favourites">{t("favorites")}</Link>
              <Link href="/account">{t("account")}</Link>
            </>
          ) : actor ? (
            <Link href={actor.role === "staff" ? "/admin" : "/seller"}>{t("account")}</Link>
          ) : (
            <>
              <Link href="/login">{t("logIn")}</Link>
              <Link href="/register" className="rounded bg-white px-3 py-1 text-purple-800">
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
