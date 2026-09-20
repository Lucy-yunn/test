"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { InvariantError, NotFoundError } from "@/lib/dal";
import {
  lockThread,
  postSupportMessage,
  resolveReport,
  setMessagingBlocked,
  unlockThread,
} from "@/lib/services/messaging";
import type { AuthFormState } from "../../register/actions";

/** Staff moderation of conversations (docs/spec/admin-tool.md section 9). Every action checks staff first. */
function done(threadId: string): void {
  revalidatePath(`/admin/threads/${threadId}`);
  revalidatePath("/admin/threads");
}

export async function postSupportAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireStaff();
  const threadId = String(formData.get("threadId"));
  try {
    await postSupportMessage(db, actor, threadId, String(formData.get("body") ?? ""));
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
  done(threadId);
  return { message: "" };
}

export async function setLockAction(formData: FormData): Promise<void> {
  const actor = await requireStaff();
  const threadId = String(formData.get("threadId"));
  if (formData.get("lock") === "true") await lockThread(db, actor, threadId);
  else await unlockThread(db, actor, threadId);
  done(threadId);
}

export async function resolveReportAction(formData: FormData): Promise<void> {
  const actor = await requireStaff();
  await resolveReport(db, actor, String(formData.get("reportId")));
  done(String(formData.get("threadId")));
}

export async function setBlockedAction(formData: FormData): Promise<void> {
  const actor = await requireStaff();
  await setMessagingBlocked(db, actor, String(formData.get("userId")), formData.get("block") === "true");
  done(String(formData.get("threadId")));
}
