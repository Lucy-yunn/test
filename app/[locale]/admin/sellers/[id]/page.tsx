import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { SellerForm } from "../seller-form";
import { LoginControls } from "../login-controls";

export default async function SellerDetailPage({
  params,
}: PageProps<"/[locale]/admin/sellers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff();

  const seller = await db.seller.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      locationName: true,
      locationLine1: true,
      locationCity: true,
      locationPostcode: true,
      locationCountry: true,
      userId: true,
      user: { select: { email: true, banned: true } },
      _count: { select: { listings: true, orders: true, threads: true } },
    },
  });
  if (!seller) notFound();

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{seller.displayName}</h1>
        <p className="text-sm text-zinc-500">
          {seller._count.listings} listings · {seller._count.orders} orders ·{" "}
          {seller._count.threads} threads
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Profile & location</h2>
        <SellerForm
          defaults={{
            id: seller.id,
            displayName: seller.displayName,
            contactName: seller.contactName,
            contactEmail: seller.contactEmail,
            contactPhone: seller.contactPhone ?? "",
            locationName: seller.locationName ?? "",
            locationLine1: seller.locationLine1 ?? "",
            locationCity: seller.locationCity,
            locationPostcode: seller.locationPostcode ?? "",
            locationCountry: seller.locationCountry,
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Login</h2>
        <LoginControls
          sellerId={seller.id}
          userId={seller.userId}
          banned={seller.user?.banned ?? false}
          contactEmail={seller.contactEmail}
        />
      </section>
    </main>
  );
}
