import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { searchParts } from "@/lib/services/parts";
import { Link } from "@/i18n/navigation";

export default async function PartsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/parts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const results = await searchParts(db, q, 50);
  // count for the empty-state hint
  const total = await db.part.count();

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Parts</h1>
        <Link href="/admin/parts/new" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          New part
        </Link>
      </div>

      <form className="flex gap-2" action="/admin/parts">
        <input
          name="q"
          defaultValue={q}
          placeholder="Code, name, or part number"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="rounded border px-3 py-2 text-sm">Search</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Code</th><th>Name</th><th>Part status</th><th>Number status</th></tr>
        </thead>
        <tbody>
          {results.map((p) => (
            <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/parts/${p.internalCode}`} className="font-mono underline">
                  {p.internalCode}
                </Link>
              </td>
              <td>{p.name}</td>
              <td>{p.partStatus}</td>
              <td>{p.pnStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {total === 0 ? "No parts yet — they're created during listing intake." : "No matches."}
        </p>
      ) : null}
    </main>
  );
}
