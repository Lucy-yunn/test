import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getListingDetail } from "@/lib/services/listing-detail";
import { findThreadForListing } from "@/lib/services/messaging";
import { StartThreadForm } from "../../../../_components/thread-forms";

/**
 * "Message seller" (docs/messaging-model.md section 3.2). A buyer who already has a
 * conversation about this listing goes straight to it. Otherwise this page holds the first
 * message, and the conversation is only created when it is sent.
 */
export default async function MessageSellerPage({ params }: PageProps<"/[locale]/listing/[code]/message">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const listingCode = decodeURIComponent(code);

  const actor = await getActor();
  if (!actor) redirect(`/login?redirect=/listing/${listingCode}/message`);

  const d = await getListingDetail(db, listingCode, actor);
  if (!d) notFound();

  const back = (
    <Link href={`/listing/${d.internalCode}`} className="text-purple-700 underline">
      Back to the part
    </Link>
  );

  if (actor.role !== "buyer") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Message the seller</h1>
        <p className="mt-3">Messaging a seller is for buyer accounts.</p>
        <p className="mt-2 text-sm">{back}</p>
      </div>
    );
  }
  if (!d.seller.available) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Message the seller</h1>
        <p className="mt-3">Messaging isn&rsquo;t available for this seller.</p>
        <p className="mt-2 text-sm">{back}</p>
      </div>
    );
  }

  const existing = await findThreadForListing(db, actor, d.internalCode);
  if (existing) redirect(`/account/messages/${existing}`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Message {d.seller.name}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        About: {d.title} · €{d.priceEur}
      </p>
      <div className="mt-4">
        <StartThreadForm listingCode={d.internalCode} />
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        Messages are text only. {back}
      </p>
    </div>
  );
}
