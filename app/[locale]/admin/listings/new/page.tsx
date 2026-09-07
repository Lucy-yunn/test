import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { ListingForm } from "../listing-form";
import { loadPartOptions } from "../parts-options";

const EMPTY = {
  partId: "",
  priceEur: "",
  condition: "used_good",
  conditionNotes: "",
  removalNotes: "",
  negotiable: false,
  noVisiblePartNumber: false,
  sellerSku: "",
  warehouseLocation: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  weightKg: "",
  packageSizeNotes: "",
};

export default async function NewListingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/listings/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const sp = await searchParams;
  const donorVehicleId = typeof sp.donor === "string" ? sp.donor : "";
  if (!donorVehicleId) notFound();

  const donor = await db.donorVehicle.findUnique({
    where: { id: donorVehicleId },
    select: { label: true, seller: { select: { displayName: true } } },
  });
  if (!donor) notFound();

  const parts = await loadPartOptions();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New listing</h1>
      <p className="text-sm text-zinc-500">
        Against <strong>{donor.label}</strong> ({donor.seller.displayName}). Price is
        copied unchanged from the seller&rsquo;s sheet. Photos and the publish
        checklist are on the listing page after you save.
      </p>
      <ListingForm defaults={{ ...EMPTY, donorVehicleId }} parts={parts} />
    </main>
  );
}
