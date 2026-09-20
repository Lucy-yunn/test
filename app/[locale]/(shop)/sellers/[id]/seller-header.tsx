import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Actor } from "@/lib/dal/actor";
import { formatDay, formatMonthYear } from "@/lib/format-date";
import type { SellerProfile } from "@/lib/services/seller-profile";
import { formatRating, type RatingSummary } from "@/lib/rating";
import { setSellerSavedAction } from "@/app/[locale]/account/saved/actions";
import { SellerContactView } from "../../_components/seller-contact";
import { ShareButton } from "./share-button";

/**
 * The seller header shown on every tab (docs/seller-profile.md section 2). The contact
 * line shows what the service allowed for this viewer.
 */
export function SellerHeader({
  profile,
  actor,
  saved,
  messageable,
  rating,
}: {
  profile: SellerProfile;
  actor: Actor | null;
  saved: boolean;
  /** The seller's parts on sale, for the "Which part is your message about?" picker. */
  messageable: { code: string; title: string; priceEur: string }[];
  rating: RatingSummary;
}) {
  const backTo = `/sellers/${profile.id}`;
  const isBuyer = actor?.role === "buyer";

  return (
    <header className="flex flex-wrap items-center gap-6 bg-purple-50 px-6 py-5 dark:bg-purple-950">
      {profile.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt={`${profile.name} avatar`}
          width={80}
          height={80}
          unoptimized
          className="h-20 w-20 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-200 text-3xl font-semibold text-purple-900">
          {profile.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold">{profile.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatRating(rating)}</p>
      </div>

      <dl className="grid gap-1 text-sm">
        <div>
          <dt className="sr-only">Location</dt>
          <dd>
            {profile.city}, {profile.country === "BG" ? "Bulgaria" : profile.country}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Phone</dt>
          <dd>
            <SellerContactView
              contact={profile.contact}
              signInHref={`/login?redirect=${backTo}`}
              signInClassName="inline-block rounded border px-3 py-1 text-purple-800 hover:bg-white dark:text-purple-300"
              emptyNote="No phone on file"
            />
          </dd>
        </div>
        <div className="text-zinc-600 dark:text-zinc-400">Last active: {formatDay(profile.lastActiveAt)}</div>
        <div className="text-zinc-600 dark:text-zinc-400">On IVO since {formatMonthYear(profile.onIvoSince)}</div>
      </dl>

      <div className="flex items-center gap-2">
        {actor && !isBuyer ? (
          <button
            type="button"
            disabled
            title="Messaging a seller is for buyer accounts"
            className="rounded border px-3 py-1 text-sm opacity-60"
          >
            Message
          </button>
        ) : (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded border px-3 py-1 text-sm">Message</summary>
            <div className="absolute right-0 z-10 mt-2 w-72 rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-900 shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              <p className="font-medium">Which part is your message about?</p>
              {messageable.length === 0 ? (
                <p className="mt-2 text-zinc-500">This seller has no parts on sale right now.</p>
              ) : (
                <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {messageable.map((l) => (
                    <li key={l.code}>
                      <Link href={`/listing/${l.code}/message`} className="block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        {l.title} <span className="text-zinc-500">€{l.priceEur}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        )}

        {!actor ? (
          <Link href={`/login?redirect=${backTo}`} className="rounded border px-3 py-1 text-sm">
            Sign in to save
          </Link>
        ) : isBuyer ? (
          <form action={setSellerSavedAction.bind(null, profile.id, !saved)}>
            <button
              type="submit"
              aria-pressed={saved}
              className={`rounded border px-3 py-1 text-sm ${saved ? "border-purple-700 bg-purple-100 text-purple-900" : ""}`}
            >
              {saved ? "Saved ♥" : "Save ♡"}
            </button>
          </form>
        ) : null}

        <ShareButton />
      </div>
    </header>
  );
}
