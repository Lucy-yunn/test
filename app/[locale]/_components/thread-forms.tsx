"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FormMessage } from "./form";
import type { AuthFormState } from "../register/actions";
import { reportThreadAction, sendMessageAction, startThreadAction } from "./thread-actions";

const MAX = 4000;

const textareaClass =
  "w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

/** The first message about a listing. */
export function StartThreadForm({ listingCode }: { listingCode: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(startThreadAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="listingCode" value={listingCode} />
      <label htmlFor="body" className="text-sm font-medium">
        Your message to the seller
      </label>
      <textarea id="body" name="body" required rows={5} maxLength={MAX} className={textareaClass} />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-purple-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "…" : "Send message"}
      </button>
      <FormMessage message={state?.message} />
    </form>
  );
}

/** The reply box. Cleared after a message is sent. `path` is the page to refresh. */
export function ReplyForm({ threadId, path }: { threadId: string; path: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(sendMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="path" value={path} />
      <label htmlFor="reply" className="sr-only">
        Reply
      </label>
      <textarea id="reply" name="body" required rows={3} maxLength={MAX} placeholder="Write a reply" className={textareaClass} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-purple-700 px-4 py-2 text-white disabled:opacity-50">
          {pending ? "…" : "Send"}
        </button>
        <FormMessage message={state?.message} />
      </div>
    </form>
  );
}

/** Report the conversation to staff, with an optional reason. */
export function ReportForm({ threadId, path, alreadyReported }: { threadId: string; path: string; alreadyReported: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(reportThreadAction, undefined);
  if (alreadyReported) return <p className="text-xs text-zinc-500">You reported this conversation. IVO staff will look at it.</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Report this conversation</summary>
      <form action={action} className="mt-2 flex max-w-md flex-col gap-2">
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="path" value={path} />
        <input
          name="reason"
          maxLength={500}
          placeholder="What is wrong? (optional)"
          aria-label="Reason (optional)"
          className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" disabled={pending} className="w-fit rounded border px-3 py-1 disabled:opacity-50">
          {pending ? "…" : "Send report"}
        </button>
        <FormMessage message={state?.message} />
      </form>
    </details>
  );
}

/** Messaging is not real-time: the page asks the server for anything new every 15 seconds while it is in view. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
