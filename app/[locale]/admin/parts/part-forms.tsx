"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { createPartAction, updatePartAction, addPartNumberAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export interface CategoryOption {
  id: string;
  name: string;
  group: string;
}

function CategorySelect({
  categories,
  defaultValue,
}: {
  categories: CategoryOption[];
  defaultValue?: string;
}) {
  const groups = [...new Set(categories.map((c) => c.group))];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="categoryId" className="text-sm font-medium">Category</label>
      <select
        id="categoryId"
        name="categoryId"
        required
        defaultValue={defaultValue ?? ""}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Choose…</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {categories.filter((c) => c.group === g).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function NewPartForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(createPartAction, undefined);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <Field label="Part name" name="name" required errors={state?.errors?.name} />
      <CategorySelect categories={categories} />
      <Field label="First part number (optional)" name="firstNumber" errors={state?.errors?.firstNumber} />
      <Field label="Notes" name="notes" />
      <SubmitButton pending={pending}>Create part</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

export function EditPartForm({
  partId,
  categories,
  defaults,
}: {
  partId: string;
  categories: CategoryOption[];
  defaults: { name: string; categoryId: string; notes: string; attributesJson: string };
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePartAction, undefined);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="partId" value={partId} />
      <Field label="Part name" name="name" required defaultValue={defaults.name} errors={state?.errors?.name} />
      <CategorySelect categories={categories} defaultValue={defaults.categoryId} />
      <Field label="Notes" name="notes" defaultValue={defaults.notes} />
      <div className="flex flex-col gap-1">
        <label htmlFor="attributesJson" className="text-sm font-medium">Attributes (JSON)</label>
        <textarea
          id="attributesJson"
          name="attributesJson"
          rows={4}
          defaultValue={defaults.attributesJson}
          className="rounded border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.attributesJson ? (
          <p className="text-sm text-red-600">{state.errors.attributesJson[0]}</p>
        ) : null}
      </div>
      <SubmitButton pending={pending}>Save</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

export function AddPartNumberForm({ partId }: { partId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(addPartNumberAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="partId" value={partId} />
      <Field label="Number" name="raw" required errors={state?.errors?.raw} />
      <div className="flex flex-col gap-1">
        <label htmlFor="numberType" className="text-sm font-medium">Type</label>
        <select id="numberType" name="numberType" className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <option value="oem">OEM</option>
          <option value="aftermarket">Aftermarket</option>
          <option value="casting">Casting</option>
          <option value="trade">Trade</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Field label="Brand" name="brand" />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="isPrimary" /> Primary</label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="verified" /> Verified</label>
      <SubmitButton pending={pending}>Add</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
