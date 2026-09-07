import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

const PAGES: Record<string, string> = {
  contacts: "Contact us",
  help: "Help centre",
  sell: "Sell with IVO",
  terms: "Terms of use",
  privacy: "Privacy policy",
  returns: "Cancellations & returns",
  "how-matching-works": "How matching works",
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export default async function InfoPage({ params }: PageProps<"/[locale]/info/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const title = PAGES[slug];
  if (!title) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Placeholder content. The real copy for this page needs a proper pass
        before launch (docs/buyer-funnel-search.md §6).
      </p>
    </main>
  );
}
