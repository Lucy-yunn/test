import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/dal/session";
import { SellerForm } from "../seller-form";

const EMPTY = {
  displayName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  locationName: "",
  locationLine1: "",
  locationCity: "",
  locationPostcode: "",
  locationCountry: "BG",
};

export default async function NewSellerPage({ params }: PageProps<"/[locale]/admin/sellers/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New seller</h1>
      <p className="text-sm text-zinc-500">
        Phase 1 — profile only, no login. You can add listings against this seller
        right away; provision a login later from the seller page.
      </p>
      <SellerForm defaults={EMPTY} />
    </main>
  );
}
