"use client";

import { useActionState } from "react";
import { FormMessage } from "../../_components/form";
import type { AuthFormState } from "../../register/actions";
import { hideReviewAction } from "./actions";

/** Hide needs a reason. */
export function HideReviewForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(hideReviewAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input
        name="reason"
        required
        placeholder="Reason for hiding"
        aria-label="Reason for hiding"
        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button type="submit" disabled={pending} className="rounded border px-2 py-1 text-sm disabled:opacity-50">
        {pending ? "…" : "Hide"}
      </button>
      <FormMessage message={state?.message} />
    </form>
  );
}
