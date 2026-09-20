import { getActor } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { isListingSaved } from "@/lib/services/favourites";
import { setSavedAction } from "@/app/[locale]/account/saved/actions";
import { Link } from "@/i18n/navigation";

/**
 * Reserve / Save / Message seller (docs/auth-and-permissions.md §7.1).
 * Anonymous → routed through /login. seller / staff → disabled. Message needs
 * the seller to have a login. Save (build step 6), Reserve (step 10) and Message seller (step 11) are live.
 */
export async function ListingActions({
  code,
  price,
  status,
  negotiable,
  sellerAvailable,
}: {
  code: string;
  price: string;
  status: string;
  negotiable: boolean;
  sellerAvailable: boolean;
}) {
  const actor = await getActor();
  const backTo = `/listing/${code}`;
  const isBuyer = actor?.role === "buyer";
  const saved = await isListingSaved(db, actor, code);

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-2xl font-semibold">€{price}</p>
      {negotiable ? <p className="text-sm text-zinc-500">Price negotiable — ask in Messages</p> : null}

      <div className="mt-3 flex flex-col gap-2">
        {!actor ? (
          <>
            <Link href={`/login?redirect=${backTo}`} className="rounded bg-purple-700 px-4 py-2 text-center text-white">
              Sign in to reserve
            </Link>
            <Link href={`/login?redirect=${backTo}`} className="rounded border px-4 py-2 text-center text-sm">
              Sign in to save
            </Link>
          </>
        ) : isBuyer ? (
          <>
            {status === "published" && sellerAvailable ? (
              <Link href={`/listing/${code}/reserve`} className="rounded bg-purple-700 px-4 py-2 text-center text-white">
                Reserve this part
              </Link>
            ) : (
              <>
                <button disabled className="rounded bg-purple-700 px-4 py-2 text-white opacity-60">
                  Reserve this part
                </button>
                <p className="text-xs text-zinc-500">
                  {!sellerAvailable ? "This seller is temporarily unavailable." : "This item is no longer available."}
                </p>
              </>
            )}
            <form action={setSavedAction.bind(null, code, !saved)}>
              <button
                type="submit"
                aria-pressed={saved}
                className={`w-full rounded border px-4 py-2 text-sm ${saved ? "border-purple-700 bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200" : ""}`}
              >
                {saved ? "Saved ♥ (remove)" : "Save ♡"}
              </button>
            </form>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Reserving is for buyer accounts.</p>
        )}

        {sellerAvailable ? (
          actor && !isBuyer ? null : (
            <Link
              href={`/listing/${code}/message`}
              className="rounded border px-4 py-2 text-center text-sm"
            >
              Message seller
            </Link>
          )
        ) : (
          <p className="text-xs text-zinc-500">Messaging isn&rsquo;t available for this seller.</p>
        )}
      </div>
    </div>
  );
}
