"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { createSellerAction, updateSellerAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export interface SellerDefaults {
  id?: string;
  displayName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  locationName: string;
  locationLine1: string;
  locationCity: string;
  locationPostcode: string;
  locationCountry: string;
}

export function SellerForm({ defaults }: { defaults: SellerDefaults }) {
  const editing = Boolean(defaults.id);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    editing ? updateSellerAction : createSellerAction,
    undefined,
  );

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {defaults.id ? <input type="hidden" name="sellerId" value={defaults.id} /> : null}
      <Field label="Display name" name="displayName" required defaultValue={defaults.displayName} errors={state?.errors?.displayName} />
      <Field label="Contact name" name="contactName" required defaultValue={defaults.contactName} errors={state?.errors?.contactName} />
      <Field label="Contact email" name="contactEmail" type="email" required defaultValue={defaults.contactEmail} errors={state?.errors?.contactEmail} />
      <Field label="Contact phone" name="contactPhone" defaultValue={defaults.contactPhone} errors={state?.errors?.contactPhone} />

      <h3 className="mt-2 font-medium">Location</h3>
      <Field label="Location name" name="locationName" defaultValue={defaults.locationName} />
      <Field label="Address line" name="locationLine1" defaultValue={defaults.locationLine1} />
      <Field label="City" name="locationCity" required defaultValue={defaults.locationCity} errors={state?.errors?.locationCity} />
      <Field label="Postcode" name="locationPostcode" defaultValue={defaults.locationPostcode} />
      <Field label="Country" name="locationCountry" required defaultValue={defaults.locationCountry || "BG"} />

      <SubmitButton pending={pending}>{editing ? "Save" : "Create seller"}</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
