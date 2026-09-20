import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { getSellerProfile } from "@/lib/services/seller-profile";
import { isSellerSaved } from "@/lib/services/saved-sellers";
import { listMessageableListings } from "@/lib/services/messaging";
import { getSellerRating } from "@/lib/services/reviews";
import type { SP } from "../../browse/browse-nav";
import { SellerHeader } from "./seller-header";
import { CarsTab } from "./cars-tab";
import { PartsTab } from "./parts-tab";
import { ReviewsTab, parseReviewSort } from "./reviews-tab";

const TABS = [
  { key: "cars", label: "All Cars" },
  { key: "parts", label: "Parts" },
  { key: "reviews", label: "Reviews" },
] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/sellers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const profile = await getSellerProfile(db, id);
  return { title: profile ? `${profile.name} · IVO` : "Seller not found" };
}

/**
 * The public seller profile (docs/seller-profile.md). Open to anyone; the phone number is
 * only returned to a signed-in viewer. A seller with no login, or nothing published yet,
 * has no profile.
 */
export default async function SellerProfilePage({
  params,
  searchParams,
}: PageProps<"/[locale]/sellers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = (await searchParams) as SP;

  const actor = await getActor();
  // Independent of each other, so ask together. A saved flag for a seller with no profile is simply unused.
  // The parts a buyer can ask about are only needed for buyers and visitors, who see the Message picker.
  const canMessage = !actor || actor.role === "buyer";
  const [profile, saved, rating, messageable] = await Promise.all([
    getSellerProfile(db, id, actor),
    isSellerSaved(db, actor, id),
    getSellerRating(db, id),
    canMessage ? listMessageableListings(db, id) : Promise.resolve([]),
  ]);
  if (!profile) notFound();
  const requested = typeof sp.tab === "string" ? sp.tab : "cars";
  const tab = TABS.find((t) => t.key === requested)?.key ?? "cars";

  return (
    <div>
      <SellerHeader profile={profile} actor={actor} saved={saved} messageable={messageable} rating={rating} />

      <nav className="flex border-b border-zinc-200 text-sm font-medium dark:border-zinc-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/sellers/${id}?tab=${t.key}`}
            className={`flex-1 px-4 py-3 text-center ${
              tab === t.key ? "border-b-2 border-purple-700 text-purple-800 dark:text-purple-300" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {tab === "cars" ? <CarsTab sellerId={id} sp={sp} /> : null}
        {tab === "parts" ? <PartsTab sellerId={id} sp={sp} /> : null}
        {tab === "reviews" ? (
          <ReviewsTab sellerId={id} sort={parseReviewSort(typeof sp.sort === "string" ? sp.sort : undefined)} actor={actor} />
        ) : null}
      </div>
    </div>
  );
}
