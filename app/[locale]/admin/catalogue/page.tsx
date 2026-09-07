import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import {
  AddMakeForm,
  AddModelGroupForm,
  AddGenerationForm,
} from "./catalogue-forms";
import { toggleActiveAction } from "./actions";

export default async function CataloguePage({ params }: PageProps<"/[locale]/admin/catalogue">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const makes = await db.vehicleMake.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      modelGroups: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: { select: { generations: true } },
        },
      },
    },
  });

  const flatModelGroups = makes.flatMap((m) =>
    m.modelGroups.map((mg) => ({ id: mg.id, name: `${m.name} — ${mg.name}` })),
  );

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Vehicle catalogue</h1>
      <p className="text-sm text-zinc-500">
        The repo seed fixture is the source of truth. Use this mainly to add a
        generation during intake. Deactivating hides a row from the funnel without
        deleting it.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <AddMakeForm />
        <AddModelGroupForm makes={makes.map((m) => ({ id: m.id, name: m.name }))} />
        <AddGenerationForm modelGroups={flatModelGroups} />
      </div>

      <div className="flex flex-col gap-4">
        {makes.map((m) => (
          <div key={m.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {m.name} {m.isActive ? "" : <span className="text-zinc-400">(inactive)</span>}
              </h2>
              <ToggleActive model="vehicleMake" id={m.id} isActive={m.isActive} />
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {m.modelGroups.map((mg) => (
                <li key={mg.id} className="flex items-center justify-between">
                  <span>
                    {mg.name} · {mg._count.generations} generations
                    {mg.isActive ? "" : " (inactive)"}
                  </span>
                  <ToggleActive model="vehicleModelGroup" id={mg.id} isActive={mg.isActive} />
                </li>
              ))}
              {m.modelGroups.length === 0 ? (
                <li className="text-zinc-500">No model groups.</li>
              ) : null}
            </ul>
          </div>
        ))}
        {makes.length === 0 ? <p className="text-sm text-zinc-500">Catalogue is empty — run the seed.</p> : null}
      </div>
    </main>
  );
}

function ToggleActive({
  model,
  id,
  isActive,
}: {
  model: string;
  id: string;
  isActive: boolean;
}) {
  return (
    <form action={toggleActiveAction}>
      <input type="hidden" name="model" value={model} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <button className="rounded border px-2 py-1 text-xs">
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
