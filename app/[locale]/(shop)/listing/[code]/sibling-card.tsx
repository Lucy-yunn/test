import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { SiblingCard as Card } from "@/lib/services/listing-detail";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used — good",
  needs_repair: "Needs repair",
};

/** The Browse listing card, minus the provenance line (identical on every card
 *  in this section — the caption states the donor once) and minus any fit badge. */
export function SiblingCard({ card }: { card: Card }) {
  return (
    <Link
      href={`/listing/${card.internalCode}`}
      className="flex gap-3 rounded border border-zinc-200 p-2 hover:border-purple-400 dark:border-zinc-800"
    >
      <div className="relative h-16 w-20 shrink-0">
        {card.photoUrl ? (
          <Image src={card.photoUrl} alt={card.title} fill unoptimized className="rounded object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800">
            no photo
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium">{card.title}</p>
        <p className="text-xs text-zinc-500">
          {CONDITION_LABEL[card.condition] ?? card.condition}
          {card.status === "reserved" ? " · reserved" : ""}
        </p>
        <p className="font-semibold">€{card.priceEur}</p>
      </div>
    </Link>
  );
}
