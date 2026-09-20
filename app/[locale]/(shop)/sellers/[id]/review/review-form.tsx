"use client";

import { useActionState } from "react";
import { FormMessage } from "@/app/[locale]/_components/form";
import type { AuthFormState } from "@/app/[locale]/register/actions";
import { createReviewAction } from "./actions";

const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

/** Rating, optional text, and the purchase (only when the buyer has completed orders with this seller that are not reviewed yet). */
export function ReviewForm({
  sellerId,
  orders,
  defaultOrderId,
}: {
  sellerId: string;
  orders: { orderId: string; partName: string; code: string }[];
  defaultOrderId: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(createReviewAction, undefined);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="sellerId" value={sellerId} />

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Rating</legend>
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1 text-sm">
              <input type="radio" name="rating" value={n} required />
              {n} <span aria-hidden className="text-amber-500">★</span>
            </label>
          ))}
        </div>
        {state?.errors?.rating ? <p className="text-sm text-red-600">{state.errors.rating[0]}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="body" className="text-sm font-medium">
          Your review (optional)
        </label>
        <textarea id="body" name="body" rows={5} maxLength={2000} className={inputClass} />
      </div>

      {orders.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="orderId" className="text-sm font-medium">
            Purchase
          </label>
          <select id="orderId" name="orderId" defaultValue={defaultOrderId} className={inputClass}>
            {orders.map((o) => (
              <option key={o.orderId} value={o.orderId}>
                {o.partName} ({o.code})
              </option>
            ))}
            <option value="">No purchase</option>
          </select>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-purple-700 px-4 py-2 text-white disabled:opacity-50">
          {pending ? "…" : "Post review"}
        </button>
        <FormMessage message={state?.message} />
      </div>
      <p className="text-xs text-zinc-500">A review cannot be edited or deleted after you post it.</p>
    </form>
  );
}
