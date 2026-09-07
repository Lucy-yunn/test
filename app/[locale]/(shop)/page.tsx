import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getFunnelTree, getInStockCategories } from "@/lib/services/catalogue";
import { Link } from "@/i18n/navigation";
import { FunnelBar } from "./_components/funnel-bar";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  const [tree, inStock] = await Promise.all([
    getFunnelTree(db),
    getInStockCategories(db, 24),
  ]);

  return (
    <>
      <section className="bg-purple-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="mt-3 max-w-xl text-white/80">{t("subhead")}</p>
          <div className="mt-8">
            <FunnelBar tree={tree} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">What&rsquo;s in stock right now</h2>
          <span className="text-sm text-zinc-500">across every car in the catalogue</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {inStock.map((c) => (
            <Link
              key={c.slug}
              href={`/browse?category=${c.slug}`}
              className="flex items-center justify-between rounded border border-zinc-200 px-4 py-3 hover:border-purple-400 dark:border-zinc-800"
            >
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="block text-xs text-zinc-400">{c.group}</span>
              </span>
              <span className="text-lg font-semibold">{c.count}</span>
            </Link>
          ))}
          {inStock.length === 0 ? (
            <p className="col-span-full text-sm text-zinc-500">
              Nothing published yet — check back soon.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
