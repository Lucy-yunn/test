import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/dal/session";

export default async function PartsPage({ params }: PageProps<"/[locale]/admin/parts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();
  return (
    <main className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Parts</h1>
      <p className="text-sm text-zinc-500">
        Parts & PartNumber management (search, de-dup, status, merge) arrives in the
        next build step.
      </p>
    </main>
  );
}
