import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/dal/session";

export default async function ListingsPage({ params }: PageProps<"/[locale]/admin/listings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();
  return (
    <main className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Listings</h1>
      <p className="text-sm text-zinc-500">
        Donor-vehicle &amp; listing editor, publish checklist and photo upload
        arrive in the next build step.
      </p>
    </main>
  );
}
