import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";

export default async function BuyersPage({ params }: PageProps<"/[locale]/admin/buyers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const buyers = await db.buyer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      city: true,
      user: { select: { name: true, email: true } },
      _count: { select: { orders: true } },
    },
  });

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Buyers</h1>
      <p className="text-sm text-zinc-500">Buyers self-register. The only action here is password reset.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Name</th><th>Email</th><th>City</th><th>Orders</th></tr>
        </thead>
        <tbody>
          {buyers.map((b) => (
            <tr key={b.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/buyers/${b.id}`} className="underline">{b.user.name}</Link>
              </td>
              <td>{b.user.email}</td>
              <td>{b.city ?? "—"}</td>
              <td>{b._count.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {buyers.length === 0 ? <p className="text-sm text-zinc-500">No buyers yet.</p> : null}
    </main>
  );
}
