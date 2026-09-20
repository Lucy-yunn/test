"use server";

import * as z from "zod";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { ForbiddenError, NotFoundError } from "@/lib/dal";
import { changePassword } from "@/lib/services/accounts";
import { changePasswordSchema } from "@/lib/validation/auth";
import type { AuthFormState } from "../../register/actions";

/** The seller's own password, the one thing they can change about their account (docs/seller-center.md section 4). */
export async function changeSellerPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireSeller();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  try {
    await changePassword(db, {
      userId: actor.userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return { errors: { currentPassword: [err.message] } };
    if (err instanceof NotFoundError) return { message: "This account has no password to change." };
    throw err;
  }
  return { message: "Password changed" };
}
