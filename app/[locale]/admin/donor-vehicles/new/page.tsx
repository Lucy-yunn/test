import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/dal/session";
import { DonorVehicleForm } from "../donor-vehicle-form";
import { loadSellerOptions, loadGenerationOptions, EMPTY_DONOR } from "../options";

export default async function NewDonorVehiclePage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/donor-vehicles/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const [sellers, generations, sp] = await Promise.all([
    loadSellerOptions(),
    loadGenerationOptions(),
    searchParams,
  ]);
  const sellerId = typeof sp.seller === "string" ? sp.seller : "";

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New donor vehicle</h1>
      <p className="text-sm text-zinc-500">
        The car once — listings hang off it. Resolve a &ldquo;— NOT LISTED —&rdquo;
        generation by adding it in the vehicle catalogue first.
      </p>
      <DonorVehicleForm
        defaults={{ ...EMPTY_DONOR, sellerId }}
        sellers={sellers}
        generations={generations}
      />
    </main>
  );
}
