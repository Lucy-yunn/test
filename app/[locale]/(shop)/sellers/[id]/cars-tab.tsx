import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import {
  listSellerCars,
  parseMileageBand,
  MILEAGE_BANDS,
  type SellerCar,
  type SellerCarSort,
} from "@/lib/services/seller-profile";
import { browseHref, toggleHref, type SP } from "../../browse/browse-nav";

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

const SORTS: { value: SellerCarSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most_parts", label: "Most parts" },
];

/** The All Cars tab (docs/seller-profile.md section 4): the seller's donor vehicles. */
export async function CarsTab({ sellerId, sp }: { sellerId: string; sp: SP }) {
  const base = `/sellers/${sellerId}`;
  const sort: SellerCarSort = str(sp.sort) === "most_parts" ? "most_parts" : "newest";
  const mileage = parseMileageBand(str(sp.mileage));

  const { cars, total, facets } = await listSellerCars(db, sellerId, {
    make: str(sp.make),
    generation: str(sp.generation),
    fuel: str(sp.fuel),
    mileage,
    onShelfOnly: str(sp.shelf) === "1",
    sort,
  });

  const anyFilter = ["make", "generation", "fuel", "mileage", "shelf"].some((k) => str(sp[k]));

  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-5 text-sm">
        <Group title="Make" param="make" sp={sp} base={base} options={facets.makes.map((m) => ({ value: m.slug, label: m.name }))} />
        <Group
          title="Generation"
          param="generation"
          sp={sp}
          base={base}
          options={facets.generations.map((g) => ({ value: g.slug, label: g.label }))}
        />
        <Group title="Fuel type" param="fuel" sp={sp} base={base} options={facets.fuels.map((f) => ({ value: f, label: f }))} />
        <Group title="Mileage" param="mileage" sp={sp} base={base} options={MILEAGE_BANDS} />
        <div>
          <Link
            href={toggleHref(sp, "shelf", "1", base)}
            className={`rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${str(sp.shelf) === "1" ? "font-semibold text-purple-700" : ""}`}
          >
            {str(sp.shelf) === "1" ? "✓ " : ""}On the shelf only
          </Link>
        </div>
      </aside>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">{total} car{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-3">
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

        {total === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            {anyFilter ? (
              <>
                No cars match these filters.{" "}
                <Link href={`${base}?tab=cars`} className="text-purple-700 underline">
                  Clear filters
                </Link>
              </>
            ) : (
              "No cars yet."
            )}
          </p>
        ) : (
          <div className="mt-2">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CarCard({ car }: { car: SellerCar }) {
  const spec = [
    car.engine,
    car.fuel,
    car.transmission,
    car.mileageKm != null ? `${car.mileageKm.toLocaleString()} km` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex gap-4 border-t border-zinc-200 py-4 dark:border-zinc-800">
      <Link href={`/car/${car.id}`} className="relative h-24 w-32 shrink-0">
        {car.photoUrl ? (
          <Image src={car.photoUrl} alt="" fill unoptimized className="rounded object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
            no photo
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/car/${car.id}`} className="font-medium hover:underline">
          {car.makeName} {car.modelGroupName} {car.generationLabel}
          {car.year ? <span className="text-zinc-500"> · {car.year}</span> : null}
        </Link>
        {spec ? <p className="text-xs text-zinc-500">{spec}</p> : null}
        {car.scrapReasonFirstLine ? (
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">Scrapped: {car.scrapReasonFirstLine}</p>
        ) : null}
        <p className="mt-1 text-sm">
          <span className="font-medium">{car.onShelf}</span> on the shelf · {car.sold} sold
        </p>
      </div>
    </article>
  );
}

function Group({
  title,
  param,
  options,
  sp,
  base,
}: {
  title: string;
  param: string;
  options: { value: string; label: string }[];
  sp: SP;
  base: string;
}) {
  if (options.length === 0) return null;
  const active = str(sp[param]);
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {options.map((o) => (
          <li key={o.value}>
            <Link
              href={toggleHref(sp, param, o.value, base)}
              className={`block rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${active === o.value ? "font-semibold text-purple-700" : ""}`}
            >
              {active === o.value ? "✓ " : ""}
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
