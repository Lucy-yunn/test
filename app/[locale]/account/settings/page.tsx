import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { SettingsForms, type ProfileDefaults } from "./settings-forms";

export default async function SettingsPage({ params }: PageProps<"/[locale]/account/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const actor = await requireBuyer();
  const row = await db.buyer.findUniqueOrThrow({
    where: { id: actor.buyerId! },
    select: {
      recipientName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      country: true,
      user: { select: { name: true, email: true } },
    },
  });

  const defaults: ProfileDefaults = {
    name: row.user.name,
    email: row.user.email,
    recipientName: row.recipientName ?? "",
    phone: row.phone ?? "",
    addressLine1: row.addressLine1 ?? "",
    addressLine2: row.addressLine2 ?? "",
    city: row.city ?? "",
    postcode: row.postcode ?? "",
    country: row.country ?? "BG",
  };

  return <SettingsForms defaults={defaults} />;
}
