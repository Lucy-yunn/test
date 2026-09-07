"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { addDefectAction, removeDefectAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export function Defects({
  listingId,
  defects,
}: {
  listingId: string;
  defects: { id: string; description: string }[];
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(addDefectAction, undefined);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1 text-sm">
        {defects.map((d) => (
          <li key={d.id} className="flex items-center justify-between">
            <span>• {d.description}</span>
            <form action={removeDefectAction}>
              <input type="hidden" name="id" value={d.id} />
              <button className="text-xs underline">remove</button>
            </form>
          </li>
        ))}
        {defects.length === 0 ? <li className="text-zinc-500">No defects recorded.</li> : null}
      </ul>
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="listingId" value={listingId} />
        <Field label="Add defect" name="description" required errors={state?.errors?.description} />
        <SubmitButton pending={pending}>Add</SubmitButton>
      </form>
      <FormMessage message={state?.message} />
    </div>
  );
}
