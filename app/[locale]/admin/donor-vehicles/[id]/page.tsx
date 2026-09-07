import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { DonorVehicleForm } from "../donor-vehicle-form";
import { loadSellerOptions, loadGenerationOptions } from "../options";

const s = (v: string | number | null) => (v == null ? "" : String(v));

export default async function DonorVehicleDetailPage({
  params,
}: PageProps<"/[locale]/admin/donor-vehicles/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const dv = await db.donorVehicle.findUnique({
    where: { id },
    select: {
      id: true,
      sellerId: true,
      generationId: true,
      label: true,
      donorYear: true,
      vin: true,
      vinDerivedNotes: true,
      mileageKm: true,
      registrationCountry: true,
      notes: true,
      engine: true,
      engineCode: true,
      fuel: true,
      transmission: true,
      bodyStyle: true,
      drivetrain: true,
      listings: {
        orderBy: { createdAt: "desc" },
        select: { id: true, internalCode: true, status: true, part: { select: { name: true } } },
      },
    },
  });
  if (!dv) notFound();

  const [sellers, generations] = await Promise.all([
    loadSellerOptions(),
    loadGenerationOptions(),
  ]);

  return (
    <main className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dv.label}</h1>
        <Link
          href={`/admin/listings/new?donor=${dv.id}`}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New listing
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <DonorVehicleForm
          sellers={sellers}
          generations={generations}
          defaults={{
            id: dv.id,
            sellerId: dv.sellerId,
            generationId: dv.generationId,
            label: dv.label,
            donorYear: s(dv.donorYear),
            vin: s(dv.vin),
            vinDerivedNotes: s(dv.vinDerivedNotes),
            mileageKm: s(dv.mileageKm),
            registrationCountry: s(dv.registrationCountry),
            notes: s(dv.notes),
            engine: s(dv.engine),
            engineCode: s(dv.engineCode),
            fuel: s(dv.fuel),
            transmission: s(dv.transmission),
            bodyStyle: s(dv.bodyStyle),
            drivetrain: s(dv.drivetrain),
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Listings ({dv.listings.length})</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {dv.listings.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/listings/${l.internalCode}`} className="underline font-mono">
                {l.internalCode}
              </Link>{" "}
              — {l.part.name} · {l.status}
            </li>
          ))}
          {dv.listings.length === 0 ? <li className="text-zinc-500">No listings yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
