"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import {
  provisionLoginAction,
  toggleLoginAction,
  unlinkLoginAction,
  resetPasswordAction,
} from "./actions";
import type { AuthFormState } from "../../register/actions";

export function LoginControls({
  sellerId,
  userId,
  banned,
  contactEmail,
}: {
  sellerId: string;
  userId: string | null;
  banned: boolean;
  contactEmail: string;
}) {
  if (!userId) {
    return <ProvisionForm sellerId={sellerId} contactEmail={contactEmail} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Login: <strong>{banned ? "disabled" : "active"}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={toggleLoginAction}>
          <input type="hidden" name="sellerId" value={sellerId} />
          <input type="hidden" name="enabled" value={banned ? "true" : "false"} />
          <button className="rounded border px-3 py-1 text-sm">
            {banned ? "Enable login" : "Disable login"}
          </button>
        </form>
        <form action={unlinkLoginAction}>
          <input type="hidden" name="sellerId" value={sellerId} />
          <button className="rounded border px-3 py-1 text-sm">Unlink login</button>
        </form>
      </div>
      <ResetForm userId={userId} sellerId={sellerId} />
    </div>
  );
}

function ProvisionForm({ sellerId, contactEmail }: { sellerId: string; contactEmail: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    provisionLoginAction,
    undefined,
  );
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      <Field
        label="Login email"
        name="loginEmail"
        type="email"
        required
        defaultValue={contactEmail}
        errors={state?.errors?.loginEmail}
      />
      <SubmitButton pending={pending}>Provision login</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

function ResetForm({ userId, sellerId }: { userId: string; sellerId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    resetPasswordAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="backTo" value={`/admin/sellers/${sellerId}`} />
      <SubmitButton pending={pending}>Reset password</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
