"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { InvariantError, NotFoundError } from "@/lib/dal";
import { hideReview, unhideReview } from "@/lib/services/reviews";
import type { AuthFormState } from "../../register/actions";

/** Staff hide a review with a required reason, or bring it back. Staff cannot write, edit or reply. */
export async function hideReviewAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireStaff();
  try {
    await hideReview(db, actor, String(formData.get("reviewId")), String(formData.get("reason") ?? ""));
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/reviews");
  return undefined;
}

export async function unhideReviewAction(formData: FormData): Promise<void> {
  const actor = await requireStaff();
  await unhideReview(db, actor, String(formData.get("reviewId")));
  revalidatePath("/admin/reviews");
}
