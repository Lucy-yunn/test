import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getPublishChecklist } from "@/lib/services/listings";
import { ListingForm } from "../listing-form";
import { Defects } from "../defects";
import { PublishPanel } from "../publish-panel";
import { loadPartOptions } from "../parts-options";

const s = (v: unknown) => (v == null ? "" : String(v));

export default async function ListingDetailPage({
  params,
}: PageProps<"/[locale]/admin/listings/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const listing = await db.listing.findUnique({
    where: { internalCode: decodeURIComponent(code) },
    select: {
      id: true,
      internalCode: true,
      status: true,
      partId: true,
      priceEur: true,
      condition: true,
      conditionNotes: true,
      removalNotes: true,
      negotiable: true,
      noVisiblePartNumber: true,
      sellerSku: true,
      warehouseLocation: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
      weightKg: true,
      packageSizeNotes: true,
      donorVehicle: { select: { id: true, label: true } },
      seller: { select: { displayName: true } },
      part: { select: { internalCode: true, name: true } },
      defects: { orderBy: { displayOrder: "asc" }, select: { id: true, description: true } },
      _count: { select: { photos: true } },
    },
  });
  if (!listing) notFound();

  const [parts, checklist] = await Promise.all([
    loadPartOptions(),
    getPublishChecklist(db, listing.id),
  ]);

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="font-mono text-lg font-semibold">{listing.internalCode}</h1>
        <p className="text-sm text-zinc-500">
          {listing.part.name} · {listing.seller.displayName} ·{" "}
          <Link href={`/admin/donor-vehicles/${listing.donorVehicle.id}`} className="underline">
            {listing.donorVehicle.label}
          </Link>{" "}
          · {listing._count.photos} photos
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Publish</h2>
        <PublishPanel listingId={listing.id} status={listing.status} checklist={checklist} />
        {listing._count.photos === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Photo upload is a separate build step — the count above drives the checklist.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <ListingForm
          parts={parts}
          defaults={{
            id: listing.id,
            partId: listing.partId,
            priceEur: s(listing.priceEur),
            condition: listing.condition,
            conditionNotes: s(listing.conditionNotes),
            removalNotes: s(listing.removalNotes),
            negotiable: listing.negotiable,
            noVisiblePartNumber: listing.noVisiblePartNumber,
            sellerSku: s(listing.sellerSku),
            warehouseLocation: s(listing.warehouseLocation),
            lengthCm: s(listing.lengthCm),
            widthCm: s(listing.widthCm),
            heightCm: s(listing.heightCm),
            weightKg: s(listing.weightKg),
            packageSizeNotes: s(listing.packageSizeNotes),
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Defects</h2>
        <Defects listingId={listing.id} defects={listing.defects} />
      </section>
    </main>
  );
}
