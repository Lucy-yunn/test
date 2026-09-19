import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Actor } from "@/lib/dal/actor";
import { formatDay, formatMonthYear } from "@/lib/format-date";
import type { SellerProfile } from "@/lib/services/seller-profile";
import { setSellerSavedAction } from "@/app/[locale]/account/saved/actions";
import { ShareButton } from "./share-button";

/**
 * The seller header shown on every tab (docs/seller-profile.md section 2). The phone is
 * only rendered when the service returned it, that is, for a signed-in viewer.
 */
export function SellerHeader({
  profile,
  actor,
  saved,
}: {
  profile: SellerProfile;
  actor: Actor | null;
  saved: boolean;
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
        {/* Reviews arrive in build step 12; until then every seller reads as new. */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">New seller</p>
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
            {profile.phone ? (
              <a href={`tel:${profile.phone.replace(/\s+/g, "")}`} className="text-purple-700 underline">
                {profile.phone}
              </a>
            ) : actor ? (
              <span className="text-zinc-500">No phone on file</span>
            ) : (
              <Link
                href={`/login?redirect=${backTo}`}
                className="inline-block rounded border px-3 py-1 text-purple-800 hover:bg-white dark:text-purple-300"
              >
                Sign in to get seller contact
              </Link>
            )}
          </dd>
        </div>
        <div className="text-zinc-600 dark:text-zinc-400">Last active: {formatDay(profile.lastActiveAt)}</div>
        <div className="text-zinc-600 dark:text-zinc-400">On IVO since {formatMonthYear(profile.onIvoSince)}</div>
      </dl>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Messaging arrives in build step 11"
          className="rounded border px-3 py-1 text-sm opacity-60"
        >
          Message
        </button>

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
