import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { Link } from "@/i18n/navigation";
import { getListingDetail } from "@/lib/services/listing-detail";
import { CANCELLATION_WINDOW_DAYS } from "@/lib/services/orders";
import { ReserveForm } from "./reserve-form";

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  used_good: "Used — good",
  needs_repair: "Needs repair",
};

/**
 * The reserve confirmation page (docs/order-model.md section 2): the item, the delivery
 * address to confirm, the cash-on-delivery statement, and the button that places the order.
 */
export default async function ReservePage({ params }: PageProps<"/[locale]/listing/[code]/reserve">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const listingCode = decodeURIComponent(code);

  const actor = await getActor();
  if (!actor) redirect(`/login?redirect=/listing/${listingCode}/reserve`);

  const d = await getListingDetail(db, listingCode, actor);
  if (!d) notFound();

  const back = (
    <Link href={`/listing/${d.internalCode}`} className="text-purple-700 underline">
      Back to the part
    </Link>
  );

  let blocked: string | null = null;
  if (actor.role !== "buyer") blocked = "Reserving is for buyer accounts.";
  else if (d.status !== "published") blocked = "This item is no longer available.";
  else if (!d.seller.available) blocked = "This seller is temporarily unavailable.";

  if (blocked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Reserve this part</h1>
        <p className="mt-3">{blocked}</p>
        <p className="mt-2 text-sm">{back}</p>
      </div>
    );
  }

  const buyer = await db.buyer.findUniqueOrThrow({
    where: { id: actor.buyerId! },
    select: {
      recipientName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      country: true,
      deliveryCity: true,
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Reserve this part</h1>

      <div className="mt-4 flex items-center gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        {d.photos[0] ? (
          <Image src={d.photos[0].url} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded object-cover" />
        ) : null}
        <div>
          <p className="font-medium">{d.title}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{CONDITION_LABEL[d.condition] ?? d.condition}</p>
          <p className="text-lg font-semibold">€{d.priceEur}</p>
        </div>
      </div>

      <p className="mt-4 rounded bg-purple-50 p-3 text-sm dark:bg-purple-950">
        <strong>Cash on delivery.</strong> You pay the seller after inspecting the part at the courier. The price shown
        excludes the courier fee, which you pay to the courier.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Delivery address</h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        Check it and change it if you need to. This order keeps its own copy; your saved address is not changed.
      </p>
      <ReserveForm
        listingCode={d.internalCode}
        defaults={{
          recipientName: buyer.recipientName ?? "",
          phone: buyer.phone ?? "",
          addressLine1: buyer.addressLine1 ?? "",
          addressLine2: buyer.addressLine2 ?? "",
          city: buyer.deliveryCity ?? buyer.city ?? "",
          postcode: buyer.postcode ?? "",
          country: buyer.country ?? "BG",
        }}
      />

      <p className="mt-6 text-xs text-zinc-500">
        You can cancel a placed order at once. After the seller confirms it, a cancellation request is approved by the
        seller or automatically after {CANCELLATION_WINDOW_DAYS} days. {back}
      </p>
    </div>
  );
}
