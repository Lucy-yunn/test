import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { formatDay } from "@/lib/format-date";
import { getCreditSummary } from "@/lib/services/credits";
import { LOW_CREDIT_THRESHOLD } from "@/lib/services/seller-center";
import { markRead } from "@/lib/services/notifications";

const KIND_LABEL = { topup: "Top-up", publish: "Listing published", adjustment: "Adjustment" } as const;

/** The credit balance and ledger, newest first (docs/seller-credits.md section 5). There is no button to buy credits. */
export default async function SellerCreditsPage({ params }: PageProps<"/[locale]/seller/credits">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const { balance, entries } = await getCreditSummary(db, actor.sellerId!);
  await markRead(db, actor, { subjectType: "credit_ledger_entry" }); // opening your credits clears the low-credit notices
  const low = balance <= LOW_CREDIT_THRESHOLD;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Credits</h1>
      <div className={`w-fit rounded border p-4 ${low ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950" : "border-zinc-200 dark:border-zinc-800"}`}>
        <p className="text-3xl font-semibold">{balance}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">credits{low ? " · running low" : ""}</p>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Publishing a listing costs one credit. To add credits, contact IVO.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No credit changes yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2">When</th>
              <th>What</th>
              <th>Amount</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2">{formatDay(e.createdAt)}</td>
                <td>{KIND_LABEL[e.kind]}</td>
                <td>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                <td>{e.note ?? e.bundleName ?? e.listingCode ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
