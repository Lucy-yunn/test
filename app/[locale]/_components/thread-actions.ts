"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { ForbiddenError, InvariantError, NotFoundError } from "@/lib/dal";
import { moveToTrash, reportThread, restoreFromTrash, sendMessage, startDirectThread, startThread } from "@/lib/services/messaging";
import type { AuthFormState } from "../register/actions";

/** A refusal the person can act on becomes a message under the form; anything else is a real error. */
function refusal(err: unknown): AuthFormState {
  if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
    return { message: err.message };
  }
  throw err;
}

/**
 * The first message of a conversation (buyers): about a listing, or, with a seller id and no
 * listing, a direct conversation with that seller. Sends the buyer to the thread.
 */
export async function startThreadAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  let threadId: string;
  try {
    const body = String(formData.get("body") ?? "");
    const sellerId = formData.get("sellerId");
    ({ threadId } =
      typeof sellerId === "string" && sellerId
        ? await startDirectThread(db, actor, { sellerId, body })
        : await startThread(db, actor, { listingCode: String(formData.get("listingCode")), body }));
  } catch (err) {
    return refusal(err);
  }
  redirect(`/account/messages/${threadId}`);
}

/** A reply from either person in the thread. `path` is the page to refresh. */
export async function sendMessageAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  try {
    await sendMessage(db, actor, String(formData.get("threadId")), String(formData.get("body") ?? ""));
  } catch (err) {
    return refusal(err);
  }
  revalidatePath(String(formData.get("path")));
  return { message: "" };
}

export async function reportThreadAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  try {
    await reportThread(db, actor, String(formData.get("threadId")), String(formData.get("reason") ?? ""));
  } catch (err) {
    return refusal(err);
  }
  revalidatePath(String(formData.get("path")));
  return { message: "Reported. IVO staff will look at this conversation." };
}

/** Move the conversation to the person's own trash, then back to their message list. */
export async function trashThreadAction(formData: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  await moveToTrash(db, actor, String(formData.get("threadId")));
  // The list is chosen here from the role, never taken from the form.
  redirect(actor.role === "seller" ? "/seller/messages" : "/account/messages");
}

/** Take the conversation out of the person's trash, and stay in it. */
export async function restoreThreadAction(formData: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  await restoreFromTrash(db, actor, String(formData.get("threadId")));
  revalidatePath(String(formData.get("path")));
}
