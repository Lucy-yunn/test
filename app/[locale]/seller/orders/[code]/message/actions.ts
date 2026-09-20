"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { ForbiddenError, InvariantError, NotFoundError } from "@/lib/dal";
import { startThreadWithOrderBuyer } from "@/lib/services/messaging";
import type { AuthFormState } from "../../../../register/actions";

/** The seller's first message to the buyer of one of their own orders. Sends the seller to the conversation. */
export async function messageBuyerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireSeller();
  let threadId: string;
  try {
    ({ threadId } = await startThreadWithOrderBuyer(db, actor, {
      orderId: String(formData.get("orderId")),
      body: String(formData.get("body") ?? ""),
    }));
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      return { message: err.message };
    }
    throw err;
  }
  redirect(`/seller/messages/${threadId}`);
}
