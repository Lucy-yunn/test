"use client";

import { useActionState } from "react";
import { SubmitButton, FormMessage } from "../../_components/form";
import { publishListingAction, setListingStatusAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export function PublishPanel({
  listingId,
  status,
  checklist,
}: {
  listingId: string;
  status: string;
  checklist: { ok: boolean; failures: string[] };
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    publishListingAction,
    undefined,
  );

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm">Status: <strong>{status}</strong></p>

      {status === "draft" ? (
        <>
          {checklist.ok ? (
            <p className="text-sm text-green-700">✓ Publish checklist met.</p>
          ) : (
            <div className="text-sm text-red-600">
              <p>Still needed to publish:</p>
              <ul className="ml-4 list-disc">
                {checklist.failures.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}
          <form action={action}>
            <input type="hidden" name="listingId" value={listingId} />
            <SubmitButton pending={pending}>Publish</SubmitButton>
          </form>
          <FormMessage message={state?.message} />
        </>
      ) : null}

      {status === "published" || status === "cancelled" ? (
        <div className="flex gap-2">
          {status === "published" ? (
            <StatusButton listingId={listingId} to="cancelled" label="Cancel listing" />
          ) : (
            <StatusButton listingId={listingId} to="published" label="Re-publish" />
          )}
          <StatusButton listingId={listingId} to="archived" label="Archive" />
        </div>
      ) : null}

      {status === "reserved" || status === "sold" ? (
        <p className="text-sm text-zinc-500">Order-driven status — not changed by staff here.</p>
      ) : null}
    </div>
  );
}

function StatusButton({
  listingId,
  to,
  label,
}: {
  listingId: string;
  to: string;
  label: string;
}) {
  return (
    <form action={setListingStatusAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="to" value={to} />
      <button className="rounded border px-3 py-1 text-sm">{label}</button>
    </form>
  );
}
