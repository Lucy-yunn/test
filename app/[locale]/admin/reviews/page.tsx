import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { formatDay } from "@/lib/format-date";
import { listReviewsForStaff } from "@/lib/services/reviews";
import { Stars } from "../../_components/stars";
import { HideReviewForm } from "./hide-form";
import { unhideReviewAction } from "./actions";

/**
 * Every review, newest first, filterable by seller and by hidden or visible
 * (docs/spec/admin-tool.md section 8). Staff can hide with a reason and unhide; they cannot
 * write, edit or reply.
 */
export default async function AdminReviewsPage({ params, searchParams }: PageProps<"/[locale]/admin/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff();
  const sp = await searchParams;

  const sellerId = typeof sp.seller === "string" && sp.seller ? sp.seller : undefined;
  const state = sp.state === "hidden" || sp.state === "visible" ? sp.state : "";
  const hidden = state === "hidden" ? true : state === "visible" ? false : undefined;

  const [reviews, sellers] = await Promise.all([
    listReviewsForStaff(db, actor, { sellerId, hidden }),
    db.seller.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Reviews</h1>
      <form className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Seller
          <select name="seller" defaultValue={sellerId ?? ""} className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All sellers</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Show
          <select name="state" defaultValue={state} className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <button className="rounded border px-3 py-1">Filter</button>
      </form>

      {reviews.length === 0 ? <p className="text-sm text-zinc-500">No reviews.</p> : null}
      <ul className="flex flex-col gap-4">
        {reviews.map((r) => (
          <li
            key={r.id}
            className={`rounded border p-3 text-sm ${r.hidden ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950" : "border-zinc-200 dark:border-zinc-800"}`}
          >
            <p>
              <strong>{r.sellerName}</strong> · reviewed by {r.authorName} · {formatDay(r.createdAt)}
            </p>
            <p className="mt-1">
              <Stars rating={r.rating} /> {r.rating} · <span className="text-zinc-500">{r.context}</span>
            </p>
            {r.body ? <p className="mt-1 whitespace-pre-wrap break-words">{r.body}</p> : null}
            {r.reply ? <p className="ml-6 mt-1 text-zinc-600 dark:text-zinc-400">Seller reply: {r.reply.body}</p> : null}
            <div className="mt-2">
              {r.hidden ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Hidden on {formatDay(r.hidden.at)}
                    {r.hidden.byName ? ` by ${r.hidden.byName}` : ""}: {r.hidden.reason}
                  </span>
                  <form action={unhideReviewAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="rounded border px-2 py-1">Unhide</button>
                  </form>
                </div>
              ) : (
                <HideReviewForm reviewId={r.id} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
