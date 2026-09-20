import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * The plain 403 page (docs/auth-and-permissions.md section 10). The role guards call forbidden()
 * when a signed-in user opens a surface their role cannot reach, and Next answers with status 403.
 */
export default async function Forbidden() {
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
