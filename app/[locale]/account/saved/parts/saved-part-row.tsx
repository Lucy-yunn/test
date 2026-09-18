import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { SavedPart } from "@/lib/services/favourites";
import { setSavedAction } from "../actions";

const BADGE: Record<SavedPart["availability"], string | null> = {
  available: null,
  reserved: "Reserved",
  sold: "Sold",
  unavailable: "No longer available",
};

/**
 * One saved part. Unavailable parts stay in the list, greyed and badged, and
 * still read through to the retained Listing (docs/seller-center.md §10). Only
 * parts a buyer can still open link to the listing page.
 */
export function SavedPartRow({ part }: { part: SavedPart }) {
  const badge = BADGE[part.availability];
  const openable = part.availability === "available" || part.availability === "reserved";
  const dimmed = part.availability === "sold" || part.availability === "unavailable";

  const thumb = part.photoUrl ? (
    <Image src={part.photoUrl} alt={part.title} fill unoptimized className="rounded object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
      no photo
    </span>
  );

  return (
    <article
      className={`flex gap-4 border-t border-zinc-200 py-4 dark:border-zinc-800 ${dimmed ? "opacity-60 grayscale" : ""}`}
    >
      <div className="relative h-20 w-28 shrink-0">
        {openable ? <Link href={`/listing/${part.code}`}>{thumb}</Link> : thumb}
      </div>

      <div className="min-w-0 flex-1">
        {openable ? (
          <Link href={`/listing/${part.code}`} className="font-medium hover:underline">
            {part.title}
          </Link>
        ) : (
          <p className="font-medium">{part.title}</p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">€{part.priceEur}</p>
        {badge ? (
          <span className="mt-1 inline-block rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            {badge}
          </span>
        ) : null}
        {part.availability !== "available" ? (
          <p className="mt-1 text-sm">
            <Link href={part.similarHref} className="text-purple-700 underline">
              Find similar
            </Link>
          </p>
        ) : null}
      </div>

      <form action={setSavedAction.bind(null, part.code, false)}>
        <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
          Remove
        </button>
      </form>
    </article>
  );
}
