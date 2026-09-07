import { setRequestLocale } from "next-intl/server";
import type { ListingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";

const STATUSES: ListingStatus[] = [
  "draft",
  "published",
  "reserved",
  "sold",
  "cancelled",
  "archived",
];

export default async function ListingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/listings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as ListingStatus)
    ? (sp.status as ListingStatus)
    : undefined;
  const sellerId = typeof sp.seller === "string" ? sp.seller : undefined;

  const where: Prisma.ListingWhereInput = {
    ...(status ? { status } : {}),
    ...(sellerId ? { sellerId } : {}),
  };

  const [rows, sellers] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        internalCode: true,
        status: true,
        priceEur: true,
        part: { select: { name: true } },
        seller: { select: { displayName: true } },
      },
    }),
    db.seller.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Listings</h1>

      <form className="flex flex-wrap gap-2 text-sm" action="/admin/listings">
        <select name="status" defaultValue={status ?? ""} className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="seller" defaultValue={sellerId ?? ""} className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Any seller</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
        </select>
        <button className="rounded border px-3 py-1">Filter</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Code</th><th>Part</th><th>Seller</th><th>Status</th><th>Price</th></tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/listings/${l.internalCode}`} className="font-mono underline">{l.internalCode}</Link>
              </td>
              <td>{l.part.name}</td>
              <td>{l.seller.displayName}</td>
              <td>{l.status}</td>
              <td>€{String(l.priceEur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="text-sm text-zinc-500">No listings match.</p> : null}
    </main>
  );
}
