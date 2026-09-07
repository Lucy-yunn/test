"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, SubmitButton, FormMessage } from "../_components/form";
import { loginAction } from "./actions";
import type { AuthFormState } from "../register/actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("loginTitle")}</h1>
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      <Field label={t("email")} name="email" type="email" required autoComplete="email" errors={state?.errors?.email} />
      <Field label={t("password")} name="password" type="password" required autoComplete="current-password" errors={state?.errors?.password} />

      <SubmitButton pending={pending}>{t("loginCta")}</SubmitButton>
      <FormMessage message={state?.message} />

      <p className="text-sm text-zinc-500">{t("troubleSigningIn")}</p>
      <p className="text-sm">
        {t("noAccount")} <Link href="/register" className="underline">{t("registerCta")}</Link>
      </p>
    </form>
  );
}
