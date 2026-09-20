"use client";

import { useActionState } from "react";
import { FormMessage } from "@/app/[locale]/_components/form";
import type { AuthFormState } from "../../../../register/actions";
import { messageBuyerAction } from "./actions";

/** The first message to the buyer of an order. */
export function MessageBuyerForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(messageBuyerAction, undefined);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="body" className="text-sm font-medium">
        Your message to the buyer
      </label>
      <textarea
        id="body"
        name="body"
        required
        rows={5}
        maxLength={4000}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-purple-700 px-4 py-2 text-white disabled:opacity-50">
          {pending ? "…" : "Send message"}
        </button>
        <FormMessage message={state?.message} />
      </div>
    </form>
  );
}
