import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { ResetPasswordButton } from "../reset-password";

export default async function BuyerDetailPage({
  params,
}: PageProps<"/[locale]/admin/buyers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const buyer = await db.buyer.findUnique({
    where: { id },
    select: {
      recipientName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      country: true,
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { orders: true } },
    },
  });
  if (!buyer) notFound();

  const addr = [
    buyer.recipientName,
    buyer.phone,
    buyer.addressLine1,
    buyer.addressLine2,
    [buyer.postcode, buyer.city].filter(Boolean).join(" "),
    buyer.country,
  ].filter(Boolean);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{buyer.user.name}</h1>
        <p className="text-sm text-zinc-500">{buyer.user.email} · {buyer._count.orders} orders</p>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Delivery address</h2>
        {addr.length ? (
          <address className="not-italic text-sm text-zinc-600 dark:text-zinc-400">
            {addr.map((l, i) => <div key={i}>{l}</div>)}
          </address>
        ) : (
          <p className="text-sm text-zinc-500">No address saved yet.</p>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Password</h2>
        <ResetPasswordButton userId={buyer.user.id} />
      </section>
    </main>
  );
}
