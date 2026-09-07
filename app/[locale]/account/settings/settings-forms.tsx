"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { updateProfileAction, changePasswordAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export interface ProfileDefaults {
  name: string;
  email: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
}

export function SettingsForms({ defaults }: { defaults: ProfileDefaults }) {
  const t = useTranslations("Account");
  const [pState, pAction, pPending] = useActionState<AuthFormState, FormData>(
    updateProfileAction,
    undefined,
  );
  const [wState, wAction, wPending] = useActionState<AuthFormState, FormData>(
    changePasswordAction,
    undefined,
  );

  return (
    <div className="flex flex-col gap-10">
      <form action={pAction} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("profile")}</h2>
        <Field label={t("name")} name="name" required defaultValue={defaults.name} errors={pState?.errors?.name} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t("email")}</label>
          <input value={defaults.email} disabled className="rounded border border-zinc-200 px-3 py-2 text-zinc-500 dark:border-zinc-800" />
          <p className="text-sm text-zinc-500">{t("emailLocked")}</p>
        </div>

        <h3 className="mt-2 font-medium">{t("deliveryAddress")}</h3>
        <Field label={t("recipientName")} name="recipientName" required defaultValue={defaults.recipientName} errors={pState?.errors?.recipientName} />
        <Field label={t("phone")} name="phone" required defaultValue={defaults.phone} errors={pState?.errors?.phone} />
        <Field label={t("addressLine1")} name="addressLine1" required defaultValue={defaults.addressLine1} errors={pState?.errors?.addressLine1} />
        <Field label={t("addressLine2")} name="addressLine2" defaultValue={defaults.addressLine2} errors={pState?.errors?.addressLine2} />
        <Field label={t("city")} name="city" required defaultValue={defaults.city} errors={pState?.errors?.city} />
        <Field label={t("postcode")} name="postcode" required defaultValue={defaults.postcode} errors={pState?.errors?.postcode} />
        <Field label={t("country")} name="country" required defaultValue={defaults.country} errors={pState?.errors?.country} />
        <SubmitButton pending={pPending}>{t("save")}</SubmitButton>
        <FormMessage message={pState?.message} />
      </form>

      <form action={wAction} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("changePassword")}</h2>
        <Field label={t("currentPassword")} name="currentPassword" type="password" required autoComplete="current-password" errors={wState?.errors?.currentPassword} />
        <Field label={t("newPassword")} name="newPassword" type="password" required autoComplete="new-password" errors={wState?.errors?.newPassword} />
        <Field label={t("confirmPassword")} name="confirmPassword" type="password" required autoComplete="new-password" errors={wState?.errors?.confirmPassword} />
        <SubmitButton pending={wPending}>{t("save")}</SubmitButton>
        <FormMessage message={wState?.message} />
      </form>
    </div>
  );
}
