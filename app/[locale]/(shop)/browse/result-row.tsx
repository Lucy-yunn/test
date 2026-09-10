import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { BrowseRow } from "@/lib/services/browse";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used — good",
  needs_repair: "Needs repair",
};

export function ResultRow({ row }: { row: BrowseRow }) {
  const d = row.donor;
  const donorDetail = [
    d.engine,
    d.engineCode,
    d.fuel,
    d.transmission,
    d.mileageKm != null ? `${d.mileageKm.toLocaleString()} km` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex gap-4 border-t border-zinc-200 py-4 dark:border-zinc-800">
      <Link href={`/listing/${row.internalCode}`} className="relative h-24 w-32 shrink-0">
        {row.photoUrl ? (
          <Image src={row.photoUrl} alt={row.title} fill unoptimized className="rounded object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
            no photo
          </span>
        )}
        {row.photoCount > 0 ? (
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
            {row.photoCount} photos
          </span>
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/listing/${row.internalCode}`} className="font-medium hover:underline">
          {row.title}
        </Link>
        <p className="text-sm text-purple-700 dark:text-purple-400">
          Taken from: {d.makeName} {d.modelGroupName} {d.generationLabel}
        </p>
        {donorDetail ? (
          <p className="text-xs text-zinc-500">{donorDetail}</p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-500">
          <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            {CONDITION_LABEL[row.condition] ?? row.condition}
          </span>
          {row.partNumber ? <> · {row.partNumber}</> : null} · Seller:{" "}
          {row.seller.name}, {row.seller.city}
        </p>
        {row.defects.length ? (
          <ul className="mt-1 list-disc pl-4 text-xs text-zinc-500">
            {row.defects.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-lg font-semibold">€{row.priceEur}</p>
        {row.negotiable ? <p className="text-xs text-zinc-500">negotiable</p> : null}
      </div>
    </article>
  );
}
