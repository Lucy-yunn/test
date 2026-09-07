import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { EditPartForm, AddPartNumberForm } from "../part-forms";
import { loadCategoryOptions } from "../categories";
import {
  confirmPartAction,
  togglePartNumberFlagAction,
  removePartNumberAction,
} from "../actions";

export default async function PartDetailPage({
  params,
}: PageProps<"/[locale]/admin/parts/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const part = await db.part.findUnique({
    where: { internalCode: decodeURIComponent(code) },
    select: {
      id: true,
      internalCode: true,
      name: true,
      categoryId: true,
      attributes: true,
      notes: true,
      partStatus: true,
      pnStatus: true,
      partNumbers: {
        orderBy: [{ isPrimary: "desc" }, { normalized: "asc" }],
        select: {
          id: true,
          raw: true,
          normalized: true,
          numberType: true,
          brand: true,
          isPrimary: true,
          verified: true,
        },
      },
      _count: { select: { listings: true } },
    },
  });
  if (!part) notFound();

  const categories = await loadCategoryOptions();

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="font-mono text-lg font-semibold">{part.internalCode}</h1>
        <p className="text-sm text-zinc-500">
          {part.name} · part status <strong>{part.partStatus}</strong> · number status{" "}
          <strong>{part.pnStatus}</strong> · {part._count.listings} listings
        </p>
        {part.partStatus === "provisional" ? (
          <form action={confirmPartAction} className="mt-2">
            <input type="hidden" name="partId" value={part.id} />
            <button className="rounded border px-3 py-1 text-sm">Confirm part (no undo)</button>
          </form>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <EditPartForm
          partId={part.id}
          categories={categories}
          defaults={{
            name: part.name,
            categoryId: part.categoryId,
            notes: part.notes ?? "",
            attributesJson: JSON.stringify(part.attributes ?? {}, null, 2),
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Part numbers</h2>
        <table className="mb-4 w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr><th className="py-2">Number</th><th>Type</th><th>Brand</th><th>Primary</th><th>Verified</th><th /></tr>
          </thead>
          <tbody>
            {part.partNumbers.map((n) => (
              <tr key={n.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 font-mono">{n.raw}</td>
                <td>{n.numberType}</td>
                <td>{n.brand ?? "—"}</td>
                <td>
                  <Toggle id={n.id} field="isPrimary" value={n.isPrimary} />
                </td>
                <td>
                  <Toggle id={n.id} field="verified" value={n.verified} />
                </td>
                <td>
                  <form action={removePartNumberAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="text-xs underline">remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {part.partNumbers.length === 0 ? (
              <tr><td colSpan={6} className="py-2 text-zinc-500">No numbers — &ldquo;no visible number&rdquo; is a valid state.</td></tr>
            ) : null}
          </tbody>
        </table>
        <AddPartNumberForm partId={part.id} />
      </section>
    </main>
  );
}

function Toggle({
  id,
  field,
  value,
}: {
  id: string;
  field: "isPrimary" | "verified";
  value: boolean;
}) {
  return (
    <form action={togglePartNumberFlagAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="next" value={value ? "false" : "true"} />
      <button className="text-xs underline">{value ? "yes" : "no"}</button>
    </form>
  );
}
