"use client";

import { useActionState } from "react";
import { FormMessage } from "@/app/[locale]/_components/form";
import type { AuthFormState } from "../../register/actions";
import { approveCancellationAction, completeOrderAction, confirmOrderAction, refuseOrderAction } from "./actions";

function ActionForm({
  action,
  orderId,
  label,
  withNote,
  tone = "primary",
}: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  orderId: string;
  label: string;
  /** Adds an optional note field (used when refusing). */
  withNote?: boolean;
  tone?: "primary" | "plain";
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      {withNote ? (
        <input
          name="note"
          placeholder="Note (optional)"
          aria-label="Note (optional)"
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`rounded px-3 py-1 text-sm disabled:opacity-50 ${tone === "primary" ? "bg-purple-700 text-white" : "border"}`}
      >
        {pending ? "…" : label}
      </button>
      <FormMessage message={state?.message} />
    </form>
  );
}

/** Only the buttons that make sense for the order's state (docs/order-model.md section 3). */
export function OrderButtons({
  orderId,
  status,
  cancellationPending,
}: {
  orderId: string;
  status: "placed" | "confirmed" | "completed" | "cancelled" | "refused";
  cancellationPending: boolean;
}) {
  if (status === "placed") {
    return <ActionForm action={confirmOrderAction} orderId={orderId} label="Confirm order" />;
  }
  if (status !== "confirmed") return null;
  if (cancellationPending) {
    return <ActionForm action={approveCancellationAction} orderId={orderId} label="Approve cancellation" />;
  }
  return (
    <div className="flex flex-col gap-2">
      <ActionForm action={completeOrderAction} orderId={orderId} label="Mark completed" />
      <ActionForm action={refuseOrderAction} orderId={orderId} label="Mark refused" withNote tone="plain" />
    </div>
  );
}
