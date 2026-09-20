"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { topUpAction, adjustCreditsAction } from "../credits/actions";
import type { AuthFormState } from "../../register/actions";

/** Staff-only controls on a seller's page: add a bundle, or adjust with a note (docs/seller-credits.md section 4). */
export function CreditsPanel({
  sellerId,
  bundles,
}: {
  sellerId: string;
  bundles: { id: string; name: string; credits: number; priceEur: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-8">
      <TopUpForm sellerId={sellerId} bundles={bundles} />
      <AdjustForm sellerId={sellerId} />
    </div>
  );
}

function TopUpForm({ sellerId, bundles }: { sellerId: string; bundles: { id: string; name: string; credits: number; priceEur: string }[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(topUpAction, undefined);
  return (
    <form action={action} className="flex w-72 flex-col gap-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="bundleId" className="text-sm font-medium">
          Add a bundle
        </label>
        <select
          id="bundleId"
          name="bundleId"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Choose…</option>
          {bundles.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.credits} credits · €{b.priceEur}
            </option>
          ))}
        </select>
        {state?.errors?.bundleId ? <p className="text-sm text-red-600">{state.errors.bundleId[0]}</p> : null}
      </div>
      <SubmitButton pending={pending}>Add credits</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

function AdjustForm({ sellerId }: { sellerId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(adjustCreditsAction, undefined);
  return (
    <form action={action} className="flex w-72 flex-col gap-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      <Field label="Adjust by (+ or -)" name="amount" type="number" required errors={state?.errors?.amount} />
      <Field label="Note (required)" name="note" required errors={state?.errors?.note} />
      <SubmitButton pending={pending}>Adjust</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
