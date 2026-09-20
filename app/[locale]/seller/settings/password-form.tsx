"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/app/[locale]/_components/form";
import type { AuthFormState } from "../../register/actions";
import { changeSellerPasswordAction } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(changeSellerPasswordAction, undefined);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <Field label="Current password" name="currentPassword" type="password" required autoComplete="current-password" errors={state?.errors?.currentPassword} />
      <Field label="New password" name="newPassword" type="password" required autoComplete="new-password" errors={state?.errors?.newPassword} />
      <Field label="Confirm new password" name="confirmPassword" type="password" required autoComplete="new-password" errors={state?.errors?.confirmPassword} />
      <SubmitButton pending={pending}>Change password</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
