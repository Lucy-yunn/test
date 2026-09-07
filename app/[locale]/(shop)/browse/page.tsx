import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { resolveBrowseContext, getFunnelTree } from "@/lib/services/catalogue";
import { browseListings, type BrowseSort } from "@/lib/services/browse";
import { Link } from "@/i18n/navigation";
import { FunnelBar } from "../_components/funnel-bar";
import { FilterRail } from "./filter-rail";
import { ResultRow } from "./result-row";
import { browseHref, pageHref, type SP } from "./browse-nav";

const SORTS: { value: BrowseSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "condition", label: "Best condition first" },
];

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const num = (v: string | string[] | undefined) => {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : undefined;
};

export default async function BrowsePage({
  params,
  searchParams,
}: PageProps<"/[locale]/browse">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = (await searchParams) as SP;

  const make = str(sp.make);
  const model = str(sp.model);

  // No car yet → the funnel prompt (the funnel is the only way in).
  if (!make || !model) {
    return <CarPrompt category={str(sp.category)} />;
  }

  const ctx = await resolveBrowseContext(db, {
    make,
    model,
    generation: str(sp.generation),
    category: str(sp.category),
  });
  if (!ctx) {
    return <CarPrompt category={str(sp.category)} note="We couldn't find that vehicle in the catalogue." />;
  }

  const isFull = ctx.generation != null;
  const result = await browseListings(db, {
    categoryId: ctx.category?.id,
    modelGroupId: isFull ? undefined : ctx.modelGroup.id,
    generationId: ctx.generation?.id,
    engine: str(sp.engine),
    fuel: str(sp.fuel),
    transmission: str(sp.transmission) as never,
    condition: str(sp.condition) as never,
    minPriceEur: num(sp.min),
    maxPriceEur: num(sp.max),
    sort: (str(sp.sort) as BrowseSort) ?? "newest",
    page: num(sp.page) ?? 1,
  });

  const activeSort = (str(sp.sort) as BrowseSort) ?? "newest";
  const chips: { label: string; href: string }[] = [];
  for (const key of ["category", "generation", "engine", "fuel", "transmission", "condition"] as const) {
    const v = str(sp[key]);
    if (v) chips.push({ label: v, href: browseHref(sp, { [key]: null }) });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav className="text-xs text-zinc-500">
        <Link href="/">Home</Link> › {ctx.make.name} › {ctx.modelGroup.name}
        {ctx.category ? <> › {ctx.category.groupName} › {ctx.category.name}</> : null}
      </nav>
      <h1 className="mt-1 text-2xl font-semibold">
        Used {ctx.make.name} {ctx.modelGroup.name} {ctx.category ? ctx.category.name : "parts"}
        {isFull ? <span className="text-zinc-500"> · {ctx.generation!.label}</span> : null}
      </h1>

      <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Parts are matched by the car they were removed from. A same-generation part
        is not guaranteed to fit — check the part number and the engine details
        before you buy.
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-[14rem_1fr]">
        <FilterRail sp={sp} facets={result.facets} showGeneration={!isFull} />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {result.total === 0
                ? "No parts found"
                : `${result.total} part${result.total === 1 ? "" : "s"} found`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Sort by</span>
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={browseHref(sp, { sort: s.value })}
                  className={activeSort === s.value ? "font-semibold text-purple-700" : "text-zinc-600 dark:text-zinc-400"}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {chips.length ? (
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {chips.map((c) => (
                <Link key={c.href + c.label} href={c.href} className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {c.label} ×
                </Link>
              ))}
              <Link href={browseHref({ make, model, generation: str(sp.generation) }, {})} className="text-purple-700 underline">
                Clear filters
              </Link>
            </div>
          ) : null}

          {result.total === 0 ? (
            <EmptyState ctx={ctx} sp={sp} isFull={isFull} />
          ) : (
            <>
              <div>
                {result.rows.map((r) => (
                  <ResultRow key={r.id} row={r} />
                ))}
              </div>
              {result.pageCount > 1 ? (
                <div className="mt-4 flex gap-1 text-sm">
                  {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={pageHref(sp, p)}
                      className={`rounded border px-2 py-1 ${p === result.page ? "border-purple-600 font-semibold" : "border-zinc-200 dark:border-zinc-700"}`}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

async function CarPrompt({ category, note }: { category?: string; note?: string }) {
  const tree = await getFunnelTree(db);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Start with your car</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {note ?? "Parts are found by the vehicle they were removed from — choose your make and model to see what's in stock."}
      </p>
      <div className="mt-6 rounded bg-purple-800 p-4">
        <FunnelBar tree={tree} initialCategory={category} />
      </div>
    </div>
  );
}

function EmptyState({
  ctx,
  sp,
  isFull,
}: {
  ctx: NonNullable<Awaited<ReturnType<typeof resolveBrowseContext>>>;
  sp: SP;
  isFull: boolean;
}) {
  return (
    <div className="mt-6 rounded border border-zinc-200 p-6 text-sm dark:border-zinc-800">
      <p className="font-medium">
        No {ctx.category?.name.toLowerCase() ?? "parts"} for this car yet
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button className="w-fit rounded bg-purple-700 px-3 py-1 text-white" disabled>
          Notify me when one is listed
        </button>
        {isFull ? (
          <Link href={browseHref(sp, { generation: null })} className="text-purple-700 underline">
            Search all {ctx.modelGroup.name} generations
          </Link>
        ) : null}
        <Link
          href={browseHref({ make: str(sp.make), model: str(sp.model), generation: str(sp.generation), category: str(sp.category) }, {})}
          className="text-purple-700 underline"
        >
          Clear the other filters
        </Link>
      </div>
    </div>
  );
}
