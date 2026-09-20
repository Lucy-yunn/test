"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/app/[locale]/_components/form";
import type { AuthFormState } from "@/app/[locale]/register/actions";
import { reserveAction } from "./actions";

export interface AddressDefaults {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
}

/** The delivery address to confirm or edit, and the button that places the order. */
export function ReserveForm({ listingCode, defaults }: { listingCode: string; defaults: AddressDefaults }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(reserveAction, undefined);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="listingCode" value={listingCode} />
      <input type="hidden" name="country" value={defaults.country} />
      <Field label="Recipient name" name="recipientName" required defaultValue={defaults.recipientName} errors={state?.errors?.recipientName} />
      <Field label="Phone" name="phone" required defaultValue={defaults.phone} errors={state?.errors?.phone} />
      <Field label="Address" name="addressLine1" required defaultValue={defaults.addressLine1} errors={state?.errors?.addressLine1} />
      <Field label="Address line 2 (optional)" name="addressLine2" defaultValue={defaults.addressLine2} errors={state?.errors?.addressLine2} />
      <Field label="City" name="city" required defaultValue={defaults.city} errors={state?.errors?.city} />
      <Field label="Postcode" name="postcode" required defaultValue={defaults.postcode} errors={state?.errors?.postcode} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Delivery is in Bulgaria.</p>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-purple-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "…" : "Reserve this part"}
      </button>
      <FormMessage message={state?.message} />
    </form>
  );
}
