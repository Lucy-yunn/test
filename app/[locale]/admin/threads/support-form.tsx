"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage } from "../../_components/form";
import type { AuthFormState } from "../../register/actions";
import { postSupportAction } from "./actions";

/** Post into the conversation as "IVO Support". Both people see it labelled as support. */
export function SupportForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(postSupportAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex max-w-xl flex-col gap-2">
      <input type="hidden" name="threadId" value={threadId} />
      <label htmlFor="support-body" className="text-sm font-medium">
        Post as IVO Support
      </label>
      <textarea
        id="support-body"
        name="body"
        required
        rows={3}
        maxLength={4000}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {pending ? "…" : "Post"}
        </button>
        <FormMessage message={state?.message} />
      </div>
    </form>
  );
}
