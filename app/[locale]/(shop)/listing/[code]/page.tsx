import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getListingDetail, getSiblingListings } from "@/lib/services/listing-detail";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/lib/dal/session";
import { formatDay } from "@/lib/format-date";
import { SellerContactView } from "../../_components/seller-contact";
import { PhotoGallery } from "./photo-gallery";
import { ListingActions } from "./listing-actions";
import { SiblingCard } from "./sibling-card";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used — good",
  needs_repair: "Needs repair",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const d = await getListingDetail(db, decodeURIComponent(code));
  return { title: d ? `${d.title} — ${d.donor.makeName} ${d.donor.modelGroupName}` : "Listing" };
}

export default async function ListingPage({ params }: PageProps<"/[locale]/listing/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const actor = await getActor();
  const d = await getListingDetail(db, decodeURIComponent(code), actor);
  if (!d) notFound();

  const siblings = await getSiblingListings(db, {
    donorVehicleId: d.donor.id,
    excludeListingId: d.id,
  });
  const firstEight = siblings.slice(0, 8);
  const rest = siblings.slice(8);

  const donorLine = [d.donor.year, d.donor.makeName, d.donor.modelGroupName, d.donor.generationLabel]
    .filter(Boolean)
    .join(" ");
  const dims = [
    d.dimensions.lengthCm && `${d.dimensions.lengthCm} cm L`,
    d.dimensions.widthCm && `${d.dimensions.widthCm} cm W`,
    d.dimensions.heightCm && `${d.dimensions.heightCm} cm H`,
    d.dimensions.weightKg && `${d.dimensions.weightKg} kg`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav className="text-xs text-zinc-500">
        <Link href="/">Home</Link> ›{" "}
        <Link href="/browse">Browse</Link> › {d.title}
      </nav>

      <div className="mt-3 grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <PhotoGallery photos={d.photos} alt={d.title} />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{d.title}</h1>
            {d.status === "reserved" ? (
              <p className="text-sm font-medium text-amber-600">Reserved — an order is in progress</p>
            ) : null}
            <p className="mt-1 text-sm text-purple-700 dark:text-purple-400">
              Taken from: {d.donor.makeName} {d.donor.modelGroupName} {d.donor.generationLabel}
            </p>
          </div>

          <ListingActions
            code={d.internalCode}
            price={d.priceEur}
            status={d.status}
            negotiable={d.negotiable}
            sellerAvailable={d.seller.available}
          />

          <div className="rounded border border-purple-200 bg-purple-50 p-4 text-sm dark:border-purple-900 dark:bg-purple-950">
            <p className="font-semibold">Seller</p>
            <div className="mt-2 flex items-center gap-3">
              {d.seller.avatarUrl ? (
                <Image
                  src={d.seller.avatarUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-200 text-lg font-semibold text-purple-900">
                  {d.seller.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0">
                {d.seller.available ? (
                  <Link href={`/sellers/${d.seller.id}`} className="font-medium hover:underline">
                    {d.seller.name}
                  </Link>
                ) : (
                  <p className="font-medium">{d.seller.name}</p>
                )}
                <p className="text-zinc-600 dark:text-zinc-400">
                  {d.seller.city}, {d.seller.country === "BG" ? "Bulgaria" : d.seller.country}
                </p>
                <p className="text-xs text-zinc-500">
                  New seller · Last active {formatDay(d.seller.lastActiveAt)}
                </p>
              </div>
            </div>

            <SellerContactView
              contact={d.seller.contact}
              signInHref={`/login?redirect=/listing/${d.internalCode}`}
              signInClassName="mt-2 inline-block rounded border bg-white px-3 py-1 text-purple-800 hover:bg-zinc-50 dark:bg-transparent dark:text-purple-300 dark:hover:bg-zinc-900"
              phoneLabel="Phone:"
              phoneClassName="mt-2"
            />

            {d.seller.available ? (
              <p className="mt-3">
                <Link href={`/sellers/${d.seller.id}?tab=parts`} className="font-medium text-purple-700 underline">
                  View all parts
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold">This part</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Condition" v={CONDITION_LABEL[d.condition] ?? d.condition} />
            {d.conditionNotes ? <Row k="Seller's notes" v={d.conditionNotes} /> : null}
            {d.removalNotes ? <Row k="Removal" v={d.removalNotes} /> : null}
            <Row k="Category" v={`${d.part.groupName} › ${d.part.categoryName}`} />
            <Row k="Part code" v={d.part.internalCode} />
            {dims.length ? <Row k="Dimensions" v={dims.join(" · ")} /> : null}
          </dl>

          {d.part.numbers.length ? (
            <>
              <h3 className="mt-3 text-sm font-semibold">Part numbers</h3>
              <ul className="mt-1 text-sm">
                {d.part.numbers.map((n) => (
                  <li key={n.raw} className="font-mono">
                    {n.raw}
                    <span className="ml-2 font-sans text-xs text-zinc-500">
                      {n.numberType}{n.brand ? ` · ${n.brand}` : ""}{n.isPrimary ? " · primary" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No visible part number on this item.</p>
          )}

          {d.defects.length ? (
            <>
              <h3 className="mt-3 text-sm font-semibold">Known defects</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {d.defects.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold">
            Donor vehicle{" "}
            <Link href={`/car/${d.donor.id}`} className="text-sm font-medium text-purple-700 underline">
              View other parts of this car
            </Link>
          </h2>
          <p className="text-xs text-zinc-500">
            The car this part was removed from. Same-generation parts are not
            guaranteed to fit — check the part number and these details against
            your own vehicle.
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Vehicle" v={donorLine} />
            {d.donor.engine ? <Row k="Engine" v={[d.donor.engine, d.donor.engineCode].filter(Boolean).join(" · ")} /> : null}
            {d.donor.fuel ? <Row k="Fuel" v={d.donor.fuel} /> : null}
            {d.donor.transmission ? <Row k="Gearbox" v={d.donor.transmission} /> : null}
            {d.donor.bodyStyle ? <Row k="Body" v={d.donor.bodyStyle} /> : null}
            {d.donor.drivetrain ? <Row k="Drivetrain" v={d.donor.drivetrain} /> : null}
            {d.donor.mileageKm != null ? <Row k="Mileage" v={`${d.donor.mileageKm.toLocaleString()} km`} /> : null}
            {d.donor.maskedVin ? <Row k="VIN" v={d.donor.maskedVin} /> : null}
            {d.donor.registrationCountry ? <Row k="Registered in" v={d.donor.registrationCountry} /> : null}
          </dl>
        </section>
      </div>

      {siblings.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            More parts from the same car · {siblings.length}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            This seller removed these parts from the same vehicle — a {donorLine}.
            They won&rsquo;t all fit your car; open a part to check its compatibility.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {firstEight.map((s) => (
              <SiblingCard key={s.internalCode} card={s} />
            ))}
          </div>
          {rest.length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-purple-700">
                See all {siblings.length}
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((s) => (
                  <SiblingCard key={s.internalCode} card={s} />
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-zinc-500">{k}</dt>
      <dd className="flex-1">{v}</dd>
    </div>
  );
}
