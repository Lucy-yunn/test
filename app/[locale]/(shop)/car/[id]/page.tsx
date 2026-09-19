import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getDonorVehiclePage, type DonorVehiclePart } from "@/lib/services/seller-profile";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used — good",
  needs_repair: "Needs repair",
};

export async function generateMetadata({ params }: PageProps<"/[locale]/car/[id]">): Promise<Metadata> {
  const { id } = await params;
  const page = await getDonorVehiclePage(db, id);
  return { title: page ? `${page.makeName} ${page.modelGroupName} ${page.generationLabel} · IVO` : "Car not found" };
}

/**
 * The donor-vehicle page, the car's ID card (docs/seller-profile.md section 6): its details,
 * why it was scrapped, and every part taken from it. On the shelf first, sold parts greyed last.
 */
export default async function DonorVehiclePageRoute({ params }: PageProps<"/[locale]/car/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const car = await getDonorVehiclePage(db, id);
  if (!car) notFound();

  const rows: [string, string | null][] = [
    ["Year", car.year ? String(car.year) : null],
    ["Engine", car.engine],
    ["Engine code", car.engineCode],
    ["Fuel", car.fuel],
    ["Gearbox", car.transmission],
    ["Body", car.bodyStyle],
    ["Drivetrain", car.drivetrain],
    ["Mileage", car.mileageKm != null ? `${car.mileageKm.toLocaleString()} km` : null],
    ["Registered in", car.registrationCountry],
    ["VIN", car.maskedVin],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav className="text-xs text-zinc-500">
        <Link href="/">Home</Link> › <Link href={`/sellers/${car.seller.id}?tab=cars`}>{car.seller.name}</Link> › Car
      </nav>

      <h1 className="mt-1 text-2xl font-semibold">
        {car.makeName} {car.modelGroupName} {car.generationLabel}
      </h1>

      <section className="mt-4 grid gap-6 md:grid-cols-[1fr_1fr]">
        <div>
          {car.photos.length ? (
            <div className="grid grid-cols-2 gap-2">
              {car.photos.map((p) => (
                <Image
                  key={p.url}
                  src={p.url}
                  alt={p.caption ?? ""}
                  width={400}
                  height={300}
                  unoptimized
                  className="h-40 w-full rounded object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="rounded bg-zinc-100 p-6 text-sm text-zinc-500 dark:bg-zinc-800">No photos of this car.</p>
          )}
        </div>

        <div>
          <dl className="space-y-1 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-2">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>

          {car.scrapReason ? (
            <div className="mt-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-sm font-semibold">Why this car was scrapped</p>
              <p className="mt-1 whitespace-pre-line text-sm">{car.scrapReason}</p>
            </div>
          ) : null}

          <p className="mt-4 flex items-center gap-2 text-sm">
            Seller:{" "}
            <Link href={`/sellers/${car.seller.id}`} className="font-medium text-purple-700 underline">
              {car.seller.name}
            </Link>
            <span className="text-zinc-500">· {car.seller.city}</span>
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Parts from this car <span className="text-sm font-normal text-zinc-500">· {car.parts.length}</span>
        </h2>
        <div className="mt-2">
          {car.parts.map((p) => (
            <PartRow key={p.code} part={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PartRow({ part }: { part: DonorVehiclePart }) {
  const sold = part.state === "sold";
  const thumb = part.photoUrl ? (
    <Image src={part.photoUrl} alt={part.title} fill unoptimized className="rounded object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
      no photo
    </span>
  );

  return (
    <article className={`flex gap-4 border-t border-zinc-200 py-3 dark:border-zinc-800 ${sold ? "opacity-60 grayscale" : ""}`}>
      <div className="relative h-16 w-24 shrink-0">
        {sold ? thumb : <Link href={`/listing/${part.code}`}>{thumb}</Link>}
      </div>
      <div className="min-w-0 flex-1">
        {sold ? (
          <p className="font-medium">{part.title}</p>
        ) : (
          <Link href={`/listing/${part.code}`} className="font-medium hover:underline">
            {part.title}
          </Link>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          €{part.priceEur} · {CONDITION_LABEL[part.condition] ?? part.condition}
        </p>
      </div>
      {sold ? (
        <span className="self-start rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
          Sold
        </span>
      ) : part.state === "reserved" ? (
        <span className="self-start rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Reserved</span>
      ) : null}
    </article>
  );
}
