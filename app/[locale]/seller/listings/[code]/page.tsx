import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getSellerListing } from "@/lib/services/seller-center";
import { LISTING_STATUS_LABEL } from "@/lib/order-labels";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used, good",
  needs_repair: "Needs repair",
};

/**
 * One listing exactly as staff entered it, read-only (docs/seller-center.md section 6.3), in
 * whatever status it has. The seller cannot change anything here.
 */
export default async function SellerListingPage({ params }: PageProps<"/[locale]/seller/listings/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const l = await getSellerListing(db, actor, decodeURIComponent(code));
  if (!l) notFound();

  const dims = [
    l.dimensions.lengthCm && `${l.dimensions.lengthCm} cm L`,
    l.dimensions.widthCm && `${l.dimensions.widthCm} cm W`,
    l.dimensions.heightCm && `${l.dimensions.heightCm} cm H`,
    l.dimensions.weightKg && `${l.dimensions.weightKg} kg`,
  ].filter(Boolean);
  const car = [l.donor.year, l.donor.makeName, l.donor.modelGroupName, l.donor.generationLabel].filter(Boolean).join(" ");

  return (
    <main className="flex flex-col gap-6">
      <Link href="/seller/listings" className="text-sm underline">
        All listings
      </Link>
      <div>
        <p className="text-sm text-zinc-500">{l.code}</p>
        <h1 className="text-xl font-semibold">{l.part.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {LISTING_STATUS_LABEL[l.status]} · €{l.priceEur}
          {l.negotiable ? " · negotiable" : ""}
        </p>
      </div>

      <ul className="flex flex-wrap gap-4 text-sm">
        <li>
          <strong>{l.counts.favourites}</strong> favourites
        </li>
        <li>
          <strong>{l.counts.orders}</strong> orders
        </li>
        <li>
          <strong>{l.counts.activeThreads}</strong> active conversations
        </li>
      </ul>

      {l.photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {l.photos.map((p) => (
            <Image key={p.url} src={p.url} alt={p.caption ?? ""} width={120} height={120} unoptimized className="h-28 w-28 rounded object-cover" />
          ))}
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">This part</h2>
        <dl className="mt-1 space-y-1 text-sm">
          <div>Condition: {CONDITION_LABEL[l.condition] ?? l.condition}</div>
          {l.conditionNotes ? <div>Notes: {l.conditionNotes}</div> : null}
          {l.removalNotes ? <div>Removal: {l.removalNotes}</div> : null}
          <div>
            Category: {l.part.groupName} › {l.part.categoryName}
          </div>
          {dims.length ? <div>Dimensions: {dims.join(" · ")}</div> : null}
          {l.part.numbers.length ? <div>Part numbers: {l.part.numbers.map((n) => n.raw).join(", ")}</div> : <div>No visible part number.</div>}
        </dl>
        {l.defects.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {l.defects.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Donor vehicle</h2>
        <dl className="mt-1 space-y-1 text-sm">
          <div>{car}</div>
          {l.donor.engine ? <div>Engine: {l.donor.engine}</div> : null}
          {l.donor.fuel ? <div>Fuel: {l.donor.fuel}</div> : null}
          {l.donor.mileageKm != null ? <div>Mileage: {l.donor.mileageKm.toLocaleString()} km</div> : null}
          {l.donor.maskedVin ? <div>VIN: {l.donor.maskedVin}</div> : null}
        </dl>
      </section>

      <p className="rounded bg-zinc-50 p-3 text-sm dark:bg-zinc-900">To change anything on this listing, message IVO.</p>
    </main>
  );
}
