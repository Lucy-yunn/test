import { getTranslations, setRequestLocale } from "next-intl/server";

/**
 * Homepage placeholder. The real buyer funnel bar (Make · Model · Generation · Part)
 * and the marketing shell are build step 5 / 12 — see docs/spec/README.md §6 and the
 * founder mocks in UI/Homepage/.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
        {t("headline")}
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">{t("subhead")}</p>
      <p className="mt-8 text-sm text-zinc-400">
        Build scaffold — see <code>docs/spec/README.md</code> for the build sequence.
      </p>
    </main>
  );
}
