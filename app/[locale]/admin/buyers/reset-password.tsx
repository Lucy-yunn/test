"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage } from "../../_components/form";
import { resetBuyerPasswordAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    resetBuyerPasswordAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton pending={pending}>Reset password</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
