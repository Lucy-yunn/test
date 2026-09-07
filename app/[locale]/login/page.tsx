import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const redirectTo = typeof sp.redirect === "string" ? sp.redirect : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <LoginForm redirectTo={redirectTo} />
    </main>
  );
}
