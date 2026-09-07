import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";

export default async function DonorVehiclesPage({
  params,
}: PageProps<"/[locale]/admin/donor-vehicles">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const rows = await db.donorVehicle.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      label: true,
      seller: { select: { displayName: true } },
      generation: { select: { label: true } },
      _count: { select: { listings: true } },
    },
  });

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Donor vehicles</h1>
        <Link href="/admin/donor-vehicles/new" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          New donor vehicle
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Label</th><th>Seller</th><th>Generation</th><th>Listings</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/donor-vehicles/${r.id}`} className="underline">{r.label}</Link>
              </td>
              <td>{r.seller.displayName}</td>
              <td>{r.generation.label}</td>
              <td>{r._count.listings}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="text-sm text-zinc-500">No donor vehicles yet.</p> : null}
    </main>
  );
}
