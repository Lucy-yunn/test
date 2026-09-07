import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Plain 403 for an authenticated user hitting a surface their role can't reach
 * (docs/auth-and-permissions.md §10). The DAL redirects here.
 */
export default async function ForbiddenPage() {
  const t = await getTranslations("Errors");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t("forbiddenTitle")}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("forbiddenBody")}</p>
      <Link href="/" className="mt-4 underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
