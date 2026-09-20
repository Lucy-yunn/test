"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { InvariantError, NotFoundError, ForbiddenError } from "@/lib/dal";
import { createReview } from "@/lib/services/reviews";
import type { AuthFormState } from "@/app/[locale]/register/actions";

const reviewSchema = z.object({
  sellerId: z.string().min(1),
  rating: z.coerce.number({ error: "Choose a rating" }).int("Choose a rating").min(1, "Choose a rating").max(5, "Choose a rating"),
  body: z.string().trim().optional(),
  orderId: z.string().trim().optional(),
});

/** The review form's button. On success the buyer lands on the seller's Reviews tab. */
export async function createReviewAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { sellerId, rating, body, orderId } = parsed.data;

  try {
    await createReview(db, actor, { sellerId, rating, body, orderId: orderId || null });
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      return { message: err.message };
    }
    throw err;
  }
  redirect(`/sellers/${sellerId}?tab=reviews`);
}
