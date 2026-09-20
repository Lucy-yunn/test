import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { browseListings, type BrowseSort } from "@/lib/services/browse";
import { getSellerRating } from "@/lib/services/reviews";
import { FilterRail } from "../../browse/filter-rail";
import { ResultRow } from "../../browse/result-row";
import { browseHref, pageHref, type SP } from "../../browse/browse-nav";

const SORTS: { value: BrowseSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "condition", label: "Best condition first" },
];

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const num = (v: string | string[] | undefined) => {
  const n = Number(str(v));
  return Number.isFinite(n) && str(v) ? n : undefined;
};

/**
 * The Parts tab (docs/seller-profile.md section 5): the same list and facets as Browse,
 * scoped to this seller. It is the Browse query with a seller condition, not a separate one.
 */
export async function PartsTab({ sellerId, sp }: { sellerId: string; sp: SP }) {
  const base = `/sellers/${sellerId}`;
  const rating = await getSellerRating(db, sellerId);
  const categorySlug = str(sp.category);
  const generationSlug = str(sp.generation);
  const [category, generation] = await Promise.all([
    categorySlug ? db.category.findFirst({ where: { slug: categorySlug }, select: { id: true } }) : null,
    generationSlug ? db.vehicleGeneration.findFirst({ where: { slug: generationSlug }, select: { id: true } }) : null,
  ]);
  const sort = (str(sp.sort) as BrowseSort) ?? "newest";

  const result = await browseListings(db, {
    sellerId,
    categoryId: category?.id,
    generationId: generation?.id,
    engine: str(sp.engine),
    fuel: str(sp.fuel),
    transmission: str(sp.transmission) as never,
    condition: str(sp.condition) as never,
    minPriceEur: num(sp.min),
    maxPriceEur: num(sp.max),
    sort,
    page: num(sp.page) ?? 1,
  });

  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
      <FilterRail sp={sp} facets={result.facets} showGeneration base={base} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">
            {result.total === 0 ? "No parts found" : `${result.total} part${result.total === 1 ? "" : "s"} found`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500">Sort by</span>
            {SORTS.map((s) => (
              <Link
                key={s.value}
                href={browseHref(sp, { sort: s.value }, base)}
                className={sort === s.value ? "font-semibold text-purple-700" : "text-zinc-600 dark:text-zinc-400"}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {result.total === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            No parts match.{" "}
            <Link href={`${base}?tab=parts`} className="text-purple-700 underline">
              Clear filters
            </Link>
          </p>
        ) : (
          <>
            <div>
              {result.rows.map((r) => (
                <ResultRow key={r.id} row={r} rating={rating} />
              ))}
            </div>
            {result.pageCount > 1 ? (
              <div className="mt-4 flex gap-1 text-sm">
                {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={pageHref(sp, p, base)}
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
  );
}
