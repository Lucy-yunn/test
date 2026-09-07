import { Link } from "@/i18n/navigation";
import type { BrowseResult } from "@/lib/services/browse";
import { toggleHref, browseHref, type SP } from "./browse-nav";

/**
 * Left filter rail (docs/buyer-funnel-search.md §4). Each option shows a live
 * count that reflects the other active filters. The Engine / Fuel / Gearbox
 * facets narrow on the DONOR vehicle's recorded value — never a fit claim.
 */
export function FilterRail({
  sp,
  facets,
  showGeneration,
}: {
  sp: SP;
  facets: BrowseResult["facets"];
  showGeneration: boolean;
}) {
  return (
    <aside className="flex flex-col gap-5 text-sm">
      {facets.categories.length > 1 ? (
        <FacetGroup title="Categories" param="category" options={facets.categories} sp={sp} />
      ) : null}
      {showGeneration && facets.generations.length > 1 ? (
        <FacetGroup title="Generation" param="generation" options={facets.generations} sp={sp} />
      ) : null}
      <FacetGroup title="Engine" param="engine" options={facets.engines} sp={sp} />
      <FacetGroup title="Fuel type" param="fuel" options={facets.fuels} sp={sp} />
      <FacetGroup title="Gearbox type" param="transmission" options={facets.transmissions} sp={sp} />
      <FacetGroup title="Quality" param="condition" options={facets.conditions} sp={sp} />

      {facets.priceRange ? (
        <div>
          <p className="font-semibold">Price</p>
          <p className="mt-1 text-xs text-zinc-500">
            €{facets.priceRange.min} – €{facets.priceRange.max} in stock
          </p>
          {(sp.min || sp.max) && (
            <Link href={browseHref(sp, { min: null, max: null })} className="text-xs text-purple-700 underline">
              clear price
            </Link>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function FacetGroup({
  title,
  param,
  options,
  sp,
}: {
  title: string;
  param: string;
  options: { value: string; label: string; count: number }[];
  sp: SP;
}) {
  if (options.length === 0) return null;
  const active = typeof sp[param] === "string" ? (sp[param] as string) : undefined;
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {options.map((o) => (
          <li key={o.value}>
            <Link
              href={toggleHref(sp, param, o.value)}
              className={`flex items-center justify-between rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                active === o.value ? "font-semibold text-purple-700" : ""
              }`}
            >
              <span>
                {active === o.value ? "✓ " : ""}
                {o.label}
              </span>
              <span className="text-xs text-zinc-400">{o.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
