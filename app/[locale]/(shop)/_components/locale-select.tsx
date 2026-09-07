"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, completeLocales } from "@/i18n/routing";

/** English is the only live locale in v1; the rest are placeholders (spec §6). */
export function LocaleSelect() {
  const t = useTranslations("LocaleSwitcher");
  const active = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState(false);

  const names: Record<string, string> = {
    en: "English",
    bg: "Български",
    nl: "Nederlands",
    de: "Deutsch",
    fr: "Français",
    ro: "Română",
  };
  const options = [...routing.locales, "nl", "de", "fr", "ro"].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <div className="flex flex-col items-end">
      <select
        aria-label={t("label")}
        value={active}
        onChange={(e) => {
          const next = e.target.value;
          if (completeLocales.includes(next as never)) {
            router.replace(pathname, { locale: next as never });
          } else {
            setNotice(true);
            e.target.value = active;
          }
        }}
        className="rounded bg-transparent text-sm text-white"
      >
        {options.map((l) => (
          <option key={l} value={l} className="text-black">
            {names[l] ?? l}
          </option>
        ))}
      </select>
      {notice ? <span className="text-xs text-white/80">{t("notTranslated")}</span> : null}
    </div>
  );
}
