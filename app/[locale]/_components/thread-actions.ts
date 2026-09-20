"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { ForbiddenError, InvariantError, NotFoundError } from "@/lib/dal";
import { reportThread, sendMessage, startThread } from "@/lib/services/messaging";
import type { AuthFormState } from "../register/actions";

/** A refusal the person can act on becomes a message under the form; anything else is a real error. */
function refusal(err: unknown): AuthFormState {
  if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
    return { message: err.message };
  }
  throw err;
}

/** The first message of a conversation about a listing (buyers). Sends the buyer to the thread. */
export async function startThreadAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  let threadId: string;
  try {
    ({ threadId } = await startThread(db, actor, {
      listingCode: String(formData.get("listingCode")),
      body: String(formData.get("body") ?? ""),
    }));
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
