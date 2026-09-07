"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import {
  addMakeAction,
  addModelGroupAction,
  addGenerationAction,
} from "./actions";
import type { AuthFormState } from "../../register/actions";

export function AddMakeForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(addMakeAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="font-medium">Add make</h3>
      <Field label="Name" name="name" required errors={state?.errors?.name} />
      <Field label="Country" name="country" />
      <SubmitButton pending={pending}>Add</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

export function AddModelGroupForm({ makes }: { makes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(addModelGroupAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="font-medium">Add model group</h3>
      <Select label="Make" name="makeId" options={makes} />
      <Field label="Name (e.g. A4, S4)" name="name" required errors={state?.errors?.name} />
      <SubmitButton pending={pending}>Add</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

export function AddGenerationForm({
  modelGroups,
}: {
  modelGroups: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(addGenerationAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="font-medium">Add generation</h3>
      <Select label="Model group" name="modelGroupId" options={modelGroups} />
      <Field label="Label (e.g. A4 S4 B8 8K (2007–2015))" name="label" required errors={state?.errors?.label} />
      <Field label="Chassis codes (comma-separated)" name="chassisCodes" />
      <div className="flex gap-2">
        <Field label="From year" name="productionStart" type="number" />
        <Field label="To year" name="productionEnd" type="number" />
      </div>
      <SubmitButton pending={pending}>Add</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <select
        id={name}
        name={name}
        required
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}
