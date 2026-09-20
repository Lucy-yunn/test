"use client";

import { useActionState } from "react";
import type { CancellationReason } from "@prisma/client";
import { Field, FormMessage } from "@/app/[locale]/_components/form";
import { CANCELLATION_REASON_LABEL } from "@/lib/order-labels";
import type { AuthFormState } from "../../../register/actions";
import { cancelOrderAction } from "../actions";

/** Cancel order: a reason is required, and "Other" needs a few words. */
export function CancelForm({ orderId, orderCode, instant }: { orderId: string; orderCode: string; instant: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(cancelOrderAction, undefined);
  return (
    <details className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <summary className="cursor-pointer font-medium">Cancel order</summary>
      <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="orderCode" value={orderCode} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {instant
            ? "The seller has not confirmed yet, so the order is cancelled at once."
            : "The seller has confirmed this order. Your request is approved by the seller, or automatically after 7 days. You cannot withdraw it."}
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="reason" className="text-sm font-medium">
            Why are you cancelling?
          </label>
          <select
            id="reason"
            name="reason"
            required
            defaultValue=""
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Choose…
            </option>
            {(Object.keys(CANCELLATION_REASON_LABEL) as CancellationReason[]).map((r) => (
              <option key={r} value={r}>
                {CANCELLATION_REASON_LABEL[r]}
              </option>
            ))}
          </select>
          {state?.errors?.reason ? <p className="text-sm text-red-600">{state.errors.reason[0]}</p> : null}
        </div>
        <Field label="Tell us more (required for Other)" name="detail" errors={state?.errors?.detail} />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
        >
          {pending ? "…" : instant ? "Cancel order" : "Request cancellation"}
        </button>
        <FormMessage message={state?.message} />
      </form>
    </details>
  );
}
