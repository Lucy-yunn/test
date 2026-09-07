import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  params,
  searchParams,
}: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const redirectTo = typeof sp.redirect === "string" ? sp.redirect : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <RegisterForm redirectTo={redirectTo} />
    </main>
  );
}
