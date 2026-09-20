"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { markAllRead } from "@/lib/services/notifications";

/** "Mark all as read": clears the signed-in person's feed. `path` is the feed page to refresh. */
export async function markAllReadAction(formData: FormData): Promise<void> {
  const actor = await getActor();
  if (actor) await markAllRead(db, actor);
  revalidatePath(String(formData.get("path") ?? "/"), "layout");
}
