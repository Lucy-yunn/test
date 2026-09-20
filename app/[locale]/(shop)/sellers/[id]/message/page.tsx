import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getSellerProfile } from "@/lib/services/seller-profile";
import { findDirectThread } from "@/lib/services/messaging";
import { StartThreadForm } from "../../../../_components/thread-forms";

/**
 * "Direct message" from a seller's profile (docs/messaging-model.md section 3.5): a
 * conversation with the seller about no listing in particular. A buyer who already has one goes
 * straight to it. Otherwise this page holds the first message, and the conversation is only
 * created when it is sent.
 */
export default async function DirectMessagePage({ params }: PageProps<"/[locale]/sellers/[id]/message">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const actor = await getActor();
  if (!actor) redirect(`/login?redirect=/sellers/${id}/message`);

  const profile = await getSellerProfile(db, id, actor);
  if (!profile) notFound();

  const back = (
    <Link href={`/sellers/${id}`} className="text-purple-700 underline">
      Back to {profile.name}
    </Link>
  );

  if (actor.role !== "buyer") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Message {profile.name}</h1>
        <p className="mt-3">Messaging a seller is for buyer accounts.</p>
        <p className="mt-2 text-sm">{back}</p>
      </div>
    );
  }

  const existing = await findDirectThread(db, actor, id);
  if (existing) redirect(`/account/messages/${existing}`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Message {profile.name}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">A direct conversation, not about a particular part.</p>
      <div className="mt-4">
        <StartThreadForm sellerId={id} />
      </div>
      <p className="mt-4 text-xs text-zinc-500">Messages are text only. {back}</p>
    </div>
  );
}
