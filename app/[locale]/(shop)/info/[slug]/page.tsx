import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { INFO_PAGES } from "@/lib/info-pages";
import { LEGAL_PLACEHOLDER_NOTE } from "@/lib/policy-copy";

export function generateStaticParams() {
  return Object.keys(INFO_PAGES).map((slug) => ({ slug }));
}

/** The policy and help pages. Two carry the real buyer policy; the others are placeholders (docs/buyer-funnel-search.md section 6). */
export default async function InfoPage({ params }: PageProps<"/[locale]/info/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = INFO_PAGES[slug];
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{page.title}</h1>
      <div className="mt-4 space-y-3 text-zinc-700 dark:text-zinc-300">
        {page.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <p className="mt-6 text-xs text-amber-700 dark:text-amber-500">{LEGAL_PLACEHOLDER_NOTE}</p>
    </main>
  );
}
