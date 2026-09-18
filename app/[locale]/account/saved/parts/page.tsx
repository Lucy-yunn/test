import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { listSavedParts } from "@/lib/services/favourites";
import { Link } from "@/i18n/navigation";
import { SavedPartRow } from "./saved-part-row";

export default async function SavedPartsPage({ params }: PageProps<"/[locale]/account/saved/parts">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const actor = await requireBuyer();
  const saved = await listSavedParts(db, actor);

  if (saved.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        You haven&rsquo;t saved any parts yet. Use <em>Save</em> on a listing to keep it here, or{" "}
        <Link href="/" className="text-purple-700 underline">start from your car</Link>.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-zinc-500">{saved.length} saved</p>
      {saved.map((part) => (
        <SavedPartRow key={part.code} part={part} />
      ))}
    </div>
  );
}
