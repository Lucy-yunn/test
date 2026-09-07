"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { ForbiddenError, NotFoundError } from "@/lib/dal";
import { changePassword, updateBuyerProfile } from "@/lib/services/accounts";
import {
  addressSchema,
  changePasswordSchema,
  profileNameSchema,
} from "@/lib/validation/auth";
import type { AuthFormState } from "../../register/actions";

const profileSchema = profileNameSchema.and(addressSchema);

export async function updateProfileAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireBuyer();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }
  const { name, ...address } = parsed.data;

  await updateBuyerProfile(db, { buyerId: actor.buyerId!, name, address });
  revalidatePath("/account/settings");
  return { message: "Saved" };
}

export async function changePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireBuyer();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await changePassword(db, {
      userId: actor.userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { errors: { currentPassword: [err.message] } };
    }
    if (err instanceof NotFoundError) {
      return { message: "This account has no password to change." };
    }
    throw err;
  }
  return { message: "Password changed" };
}
