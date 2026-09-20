"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { ForbiddenError, InvariantError, NotFoundError } from "@/lib/dal";
import { replyToReview } from "@/lib/services/reviews";
import type { AuthFormState } from "../../register/actions";

/** The seller's one reply to a review of theirs. It cannot be edited or removed afterwards. */
export async function replyToReviewAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireSeller();
  try {
    await replyToReview(db, actor, String(formData.get("reviewId")), String(formData.get("body") ?? ""));
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      return { message: err.message };
    }
    throw err;
  }
  revalidatePath("/seller/reviews");
  return undefined;
}
