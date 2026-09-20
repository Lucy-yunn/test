import { setRequestLocale } from "next-intl/server";
import { requireSeller } from "@/lib/dal/session";
import { PasswordForm } from "./password-form";

/** Change your own password. Nothing else about the account or the store can be changed here. */
export default async function SellerSettingsPage({ params }: PageProps<"/[locale]/seller/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSeller();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Change password</h2>
        <PasswordForm />
      </section>
    </main>
  );
}
