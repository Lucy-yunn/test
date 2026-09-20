import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { NotFoundError } from "@/lib/dal";
import { formatDay } from "@/lib/format-date";
import { getThreadForStaff } from "@/lib/services/messaging";
import { resolveReportAction, setBlockedAction, setLockAction } from "../actions";
import { SupportForm } from "../support-form";

const LABEL = { buyer: "Buyer", seller: "Seller", support: "IVO Support" } as const;

/** One conversation in full, with the moderation controls (docs/spec/admin-tool.md section 9). Reading it marks nothing as read. */
export default async function AdminThreadPage({ params }: PageProps<"/[locale]/admin/threads/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const actor = await requireStaff();

  let view;
  try {
    view = await getThreadForStaff(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <main className="flex flex-col gap-6">
      <Link href="/admin/threads" className="text-sm underline">
        All conversations
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{view.listing?.title ?? "Direct conversation"}</h1>
        <p className="text-sm text-zinc-500">
          {view.listing ? `${view.listing.code} · listing ${view.listing.status} · ` : "About no listing · "}
          {view.buyerName} with {view.sellerName}
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-3">
        <form action={setLockAction}>
          <input type="hidden" name="threadId" value={view.id} />
          <input type="hidden" name="lock" value={view.locked ? "false" : "true"} />
          <button className="rounded border px-3 py-1 text-sm">{view.locked ? "Unlock conversation" : "Lock conversation"}</button>
        </form>
        {view.locked ? <span className="text-sm text-zinc-500">Locked: buyer and seller see that IVO closed it.</span> : null}
      </section>

      {view.reports.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Reports</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {view.reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded border border-zinc-200 p-2 dark:border-zinc-800">
                <span>
                  Reported by the {r.reportedByRole} on {formatDay(r.createdAt)}
                  {r.reason ? `: ${r.reason}` : ""}
                </span>
                {r.state === "open" ? (
                  <form action={resolveReportAction}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="threadId" value={view.id} />
                    <button className="rounded border px-2 py-0.5">Resolve</button>
                  </form>
                ) : (
                  <span className="text-zinc-500">Resolved</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-semibold">People</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {view.people.map((p) => (
            <li key={p.role} className="flex flex-wrap items-center gap-3">
              <span>
                {LABEL[p.role]}: {p.name}
                {p.blocked ? " (blocked from messaging)" : ""}
              </span>
              {p.userId ? (
                <form action={setBlockedAction}>
                  <input type="hidden" name="userId" value={p.userId} />
                  <input type="hidden" name="threadId" value={view.id} />
                  <input type="hidden" name="block" value={p.blocked ? "false" : "true"} />
                  <button className="rounded border px-2 py-0.5">{p.blocked ? "Unblock" : "Block from messaging"}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Messages</h2>
        <ol className="flex flex-col gap-2 text-sm">
          {view.messages.map((m) => (
            <li key={m.id} className={`rounded p-2 ${m.from === "support" ? "bg-amber-50 dark:bg-amber-950" : "bg-zinc-50 dark:bg-zinc-900"}`}>
              <p className="text-xs text-zinc-500">
                {LABEL[m.from]} · {formatDay(m.sentAt)}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-zinc-500">Messages cannot be edited or deleted.</p>
      </section>

      <SupportForm threadId={view.id} />
    </main>
  );
}
