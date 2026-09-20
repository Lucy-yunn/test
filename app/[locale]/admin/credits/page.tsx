import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { listBundles } from "@/lib/services/credits";
import { BundleForm, BundleActiveToggle } from "./bundle-forms";

/** Credit bundles: what the founders sell (docs/seller-credits.md section 1). Prices are placeholders until launch. */
export default async function CreditBundlesPage({ params }: PageProps<"/[locale]/admin/credits">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const bundles = await listBundles(db);

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Credit bundles</h1>
        <p className="text-sm text-zinc-500">
          A seller pays outside the platform, then staff add a bundle on the seller&apos;s page. A switched-off bundle
          cannot be used for new top-ups; past entries are unaffected.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Add a bundle</h2>
        <BundleForm />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Bundles</h2>
        {bundles.map((b) => (
          <div key={b.id} className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="font-medium">{b.name}</span>
              <span className="text-sm text-zinc-500">{b.isActive ? "on sale" : "switched off"}</span>
              <BundleActiveToggle bundleId={b.id} isActive={b.isActive} />
            </div>
            <BundleForm
              bundleId={b.id}
              defaults={{
                name: b.name,
                credits: String(b.credits),
                priceEur: b.priceEur,
                displayOrder: String(b.displayOrder),
              }}
            />
          </div>
        ))}
        {bundles.length === 0 ? <p className="text-sm text-zinc-500">No bundles yet.</p> : null}
      </section>
    </main>
  );
}
