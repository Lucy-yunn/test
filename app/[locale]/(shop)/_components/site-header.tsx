import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { getUnreadCount } from "@/lib/services/messaging";
import { DeliveryTo } from "./delivery-to";
import { currentDeliveryLocation } from "./delivery-location";
import { LocaleSelect } from "./locale-select";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const actor = await getActor();
  const { city, source } = await currentDeliveryLocation();
  const unread = actor?.role === "buyer" ? await getUnreadCount(db, actor) : 0;

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
            <DeliveryTo
              label={t("deliveryTo", { place: city ? `Bulgaria, ${city}` : "Bulgaria" })}
              city={city}
              suggested={source === "detected"}
            />
          </span>
          <LocaleSelect />
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-3">
        <Link href="/" className="text-2xl font-bold tracking-tight">IVO</Link>
        <div className="flex items-center gap-4 text-sm">
          {actor?.role === "buyer" ? (
            <>
              <Link href="/account/orders">{t("myOrders")}</Link>
              <Link href="/account/messages">
                {t("messages")}
                {unread > 0 ? (
                  <span className="ml-1 rounded-full bg-amber-300 px-2 py-0.5 text-xs text-purple-900" aria-label={`${unread} unread`}>
                    {unread}
                  </span>
                ) : null}
              </Link>
              <Link href="/account/saved/parts">{t("saved")}</Link>
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
