import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { SellerForm } from "../seller-form";
import { LoginControls } from "../login-controls";
import { AvatarPanel } from "../avatar-panel";
import { CreditsPanel } from "../credits-panel";
import { formatDay } from "@/lib/format-date";
import { getCreditSummary, listBundles } from "@/lib/services/credits";

export default async function SellerDetailPage({
  params,
}: PageProps<"/[locale]/admin/sellers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const seller = await db.seller.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      avatarUrl: true,
      locationName: true,
      locationLine1: true,
      locationCity: true,
      locationPostcode: true,
      locationCountry: true,
      userId: true,
      user: { select: { email: true, banned: true } },
      _count: { select: { listings: true, orders: true, threads: true } },
    },
  });
  if (!seller) notFound();

  const [credits, bundles] = await Promise.all([getCreditSummary(db, id), listBundles(db)]);

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{seller.displayName}</h1>
        <p className="text-sm text-zinc-500">
          {seller._count.listings} listings · {seller._count.orders} orders ·{" "}
          {seller._count.threads} threads
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Profile & location</h2>
        <SellerForm
          defaults={{
            id: seller.id,
            displayName: seller.displayName,
            contactName: seller.contactName,
            contactEmail: seller.contactEmail,
            contactPhone: seller.contactPhone ?? "",
            locationName: seller.locationName ?? "",
            locationLine1: seller.locationLine1 ?? "",
            locationCity: seller.locationCity,
            locationPostcode: seller.locationPostcode ?? "",
            locationCountry: seller.locationCountry,
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Avatar</h2>
        <AvatarPanel sellerId={seller.id} displayName={seller.displayName} avatarUrl={seller.avatarUrl} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Credits</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Balance: <strong>{credits.balance}</strong>. Publishing a listing costs 1 credit; there are no refunds.
        </p>
        <CreditsPanel sellerId={seller.id} bundles={bundles.filter((b) => b.isActive)} />
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2">When</th>
              <th>Kind</th>
              <th>Amount</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {credits.entries.map((e) => (
              <tr key={e.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2">{formatDay(e.createdAt)}</td>
                <td>{e.kind}</td>
                <td>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                <td>{e.note ?? e.bundleName ?? e.listingCode ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {credits.entries.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No credit changes yet.</p> : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Login</h2>
        <LoginControls
          sellerId={seller.id}
          userId={seller.userId}
          banned={seller.user?.banned ?? false}
          contactEmail={seller.contactEmail}
        />
      </section>
    </main>
  );
}
