import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/dal/session";
import { NewPartForm } from "../part-forms";
import { loadCategoryOptions } from "../categories";

export default async function NewPartPage({ params }: PageProps<"/[locale]/admin/parts/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();
  const categories = await loadCategoryOptions();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New part</h1>
      <p className="text-sm text-zinc-500">
        Usually created from the listing editor. If you enter a part number here it
        is checked against existing parts first.
      </p>
      <NewPartForm categories={categories} />
    </main>
  );
}
