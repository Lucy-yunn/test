import { getActor } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { isListingSaved } from "@/lib/services/favourites";
import { setSavedAction } from "@/app/[locale]/account/saved/actions";
import { Link } from "@/i18n/navigation";

/**
 * Buy / Save / Message seller (docs/auth-and-permissions.md §7.1).
 * Anonymous → routed through /login. seller / staff → disabled. Message needs
 * the seller to have a login. Save is live (build step 6); Buy and Message are
 * wired in later steps.
 */
export async function ListingActions({
  code,
  price,
  negotiable,
  sellerHasLogin,
}: {
  code: string;
  price: string;
  negotiable: boolean;
  sellerHasLogin: boolean;
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
              Sign in to buy
            </Link>
            <Link href={`/login?redirect=${backTo}`} className="rounded border px-4 py-2 text-center text-sm">
              Sign in to save
            </Link>
          </>
        ) : isBuyer ? (
          <>
            <button disabled title="Checkout arrives in build step 7" className="rounded bg-purple-700 px-4 py-2 text-white opacity-60">
              Buy
            </button>
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
          <p className="text-sm text-zinc-500">Buying is for buyer accounts.</p>
        )}

        {sellerHasLogin ? (
          actor && !isBuyer ? null : (
            <button
              disabled
              title="Messaging arrives in build step 9"
              className="rounded border px-4 py-2 text-sm opacity-60"
            >
              Message seller
            </button>
          )
        ) : (
          <p className="text-xs text-zinc-500">Messaging isn&rsquo;t available for this seller.</p>
        )}
      </div>
    </div>
  );
}
