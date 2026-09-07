import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";

export default async function SellersPage({ params }: PageProps<"/[locale]/admin/sellers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const sellers = await db.seller.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      locationCity: true,
      userId: true,
      _count: { select: { listings: true, orders: true } },
    },
  });

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sellers</h1>
        <Link href="/admin/sellers/new" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          New seller
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-2">Name</th>
            <th>City</th>
            <th>Login</th>
            <th>Listings</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((s) => (
            <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/sellers/${s.id}`} className="underline">{s.displayName}</Link>
              </td>
              <td>{s.locationCity}</td>
              <td>{s.userId ? "yes" : "—"}</td>
              <td>{s._count.listings}</td>
              <td>{s._count.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sellers.length === 0 ? <p className="text-sm text-zinc-500">No sellers yet.</p> : null}
    </main>
  );
}
