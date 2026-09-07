import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("notFoundBody")}</p>
      <Link href="/" className="mt-4 underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
