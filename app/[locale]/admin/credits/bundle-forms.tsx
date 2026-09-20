"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { createBundleAction, updateBundleAction, setBundleActiveAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

interface Defaults {
  name: string;
  credits: string;
  priceEur: string;
  displayOrder: string;
}

const EMPTY: Defaults = { name: "", credits: "", priceEur: "", displayOrder: "0" };

/** One bundle: a create form when `bundleId` is missing, an edit form otherwise. */
export function BundleForm({ bundleId, defaults = EMPTY }: { bundleId?: string; defaults?: Defaults }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    bundleId ? updateBundleAction : createBundleAction,
    undefined,
  );
  return (
    <form action={action} className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
      {bundleId ? <input type="hidden" name="bundleId" value={bundleId} /> : null}
      <Field label="Name" name="name" required defaultValue={defaults.name} errors={state?.errors?.name} />
      <Field label="Credits" name="credits" type="number" required defaultValue={defaults.credits} errors={state?.errors?.credits} />
      <Field label="Price (EUR)" name="priceEur" required defaultValue={defaults.priceEur} errors={state?.errors?.priceEur} />
      <Field label="Order" name="displayOrder" type="number" defaultValue={defaults.displayOrder} errors={state?.errors?.displayOrder} />
      <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
        <SubmitButton pending={pending}>{bundleId ? "Save" : "Add bundle"}</SubmitButton>
        <FormMessage message={state?.message} />
      </div>
    </form>
  );
}

export function BundleActiveToggle({ bundleId, isActive }: { bundleId: string; isActive: boolean }) {
  return (
    <form action={setBundleActiveAction}>
      <input type="hidden" name="bundleId" value={bundleId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button className="rounded border px-3 py-1 text-sm">{isActive ? "Switch off" : "Switch on"}</button>
    </form>
  );
}
