"use client";

import { useActionState } from "react";
import { FormMessage } from "@/app/[locale]/_components/form";
import type { AuthFormState } from "../../register/actions";
import { replyToReviewAction } from "./actions";

/** One reply per review, plain text, up to 1,000 characters. It cannot be changed once sent. */
export function ReplyToReviewForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(replyToReviewAction, undefined);
  return (
    <form action={action} className="ml-8 mt-3 flex max-w-lg flex-col gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <label htmlFor={`reply-${reviewId}`} className="text-sm font-medium">
        Reply (once, cannot be edited)
      </label>
      <textarea
        id={`reply-${reviewId}`}
        name="body"
        required
        rows={3}
        maxLength={1000}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-purple-700 px-3 py-1 text-sm text-white disabled:opacity-50">
          {pending ? "…" : "Send reply"}
        </button>
        <FormMessage message={state?.message} />
      </div>
    </form>
  );
}
