import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { formatDay, formatMonthYear } from "@/lib/format-date";
import { formatRating } from "@/lib/rating";
import { getStoreDetails } from "@/lib/services/seller-center";

/** Your public profile fields, as buyers see them (docs/seller-center.md section 2). Read-only: IVO staff change them. */
export default async function StoreDetailsPage({ params }: PageProps<"/[locale]/seller/store">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireSeller();

  const s = await getStoreDetails(db, actor);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Store details</h1>
      <div className="flex items-center gap-4">
        {s.avatarUrl ? (
          <Image src={s.avatarUrl} alt="" width={80} height={80} unoptimized className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-200 text-3xl font-semibold text-purple-900">
            {s.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <div>
          <p className="text-lg font-semibold">{s.name}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatRating(s.rating)}</p>
        </div>
      </div>
      <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-zinc-500">Location</dt>
        <dd>
          {s.city}, {s.country === "BG" ? "Bulgaria" : s.country}
        </dd>
        <dt className="text-zinc-500">Phone</dt>
        <dd>{s.phone ?? "No phone on file"}</dd>
        <dt className="text-zinc-500">Last active</dt>
        <dd>{formatDay(s.lastActiveAt)}</dd>
        <dt className="text-zinc-500">On IVO since</dt>
        <dd>{s.onIvoSince ? formatMonthYear(s.onIvoSince) : "Not yet"}</dd>
      </dl>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This is what buyers see on your public profile. The phone number is only shown to signed-in buyers. To change any of
        it, message IVO.
      </p>
    </main>
  );
}
