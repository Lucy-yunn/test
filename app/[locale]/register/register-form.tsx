"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, SubmitButton, FormMessage } from "../_components/form";
import { registerAction, type AuthFormState } from "./actions";

export function RegisterForm({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    registerAction,
    undefined,
  );

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("registerTitle")}</h1>
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      <Field label={t("name")} name="name" required autoComplete="name" errors={state?.errors?.name} />
      <Field label={t("email")} name="email" type="email" required autoComplete="email" errors={state?.errors?.email} />
      <Field label={t("password")} name="password" type="password" required autoComplete="new-password" errors={state?.errors?.password} />

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" className="mt-1" />
        <span>{t("acceptTerms")}</span>
      </label>
      {state?.errors?.terms ? (
        <p className="text-sm text-red-600">{state.errors.terms[0]}</p>
      ) : null}

      <div className="flex gap-2 opacity-50">
        <button type="button" disabled className="rounded border px-3 py-2 text-sm">
          Google
        </button>
        <button type="button" disabled className="rounded border px-3 py-2 text-sm">
          Facebook
        </button>
      </div>

      <SubmitButton pending={pending}>{t("registerCta")}</SubmitButton>
      <FormMessage message={state?.message} />
      <p className="text-sm">
        {t("haveAccount")} <Link href="/login" className="underline">{t("loginCta")}</Link>
      </p>
    </form>
  );
}
