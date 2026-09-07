import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";

export default async function AdminHome({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const [sellers, buyers, listings, drafts, published] = await Promise.all([
    db.seller.count(),
    db.buyer.count(),
    db.listing.count(),
    db.listing.count({ where: { status: "draft" } }),
    db.listing.count({ where: { status: "published" } }),
  ]);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Back office</h1>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Sellers" value={sellers} />
        <Stat label="Buyers" value={buyers} />
        <Stat label="Listings" value={listings} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="Published" value={published} />
      </dl>
      <p className="text-sm text-zinc-500">
        Order management, cancellations and thread moderation arrive in later build
        steps. Intake: <Link href="/admin/sellers" className="underline">Sellers</Link> ·{" "}
        <Link href="/admin/catalogue" className="underline">Vehicle catalogue</Link> ·{" "}
        <Link href="/admin/parts" className="underline">Parts</Link> ·{" "}
        <Link href="/admin/listings" className="underline">Listings</Link>.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
