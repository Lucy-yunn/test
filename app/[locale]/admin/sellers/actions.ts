"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { ConflictError, InvariantError, NotFoundError } from "@/lib/dal";
import {
  createSeller,
  updateSeller,
  provisionSellerLogin,
  setSellerLoginEnabled,
  unlinkSellerLogin,
  resetUserPassword,
} from "@/lib/services/sellers";
import { provisionLoginSchema, sellerProfileSchema } from "@/lib/validation/admin";
import type { AuthFormState } from "../../register/actions";

export async function createSellerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const parsed = sellerProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const { id } = await createSeller(db, parsed.data);
  revalidatePath("/admin/sellers");
  redirect(`/admin/sellers/${id}`);
}

export async function updateSellerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const sellerId = String(formData.get("sellerId"));
  const parsed = sellerProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  await updateSeller(db, sellerId, parsed.data);
  revalidatePath(`/admin/sellers/${sellerId}`);
  return { message: "Saved" };
}

export async function provisionLoginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const sellerId = String(formData.get("sellerId"));
  const parsed = provisionLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  try {
    const { initialPassword } = await provisionSellerLogin(db, {
      sellerId,
      loginEmail: parsed.data.loginEmail,
    });
    revalidatePath(`/admin/sellers/${sellerId}`);
    return {
      message: `Login created. Initial password (shown once): ${initialPassword}`,
    };
  } catch (err) {
    if (err instanceof ConflictError) return { errors: { loginEmail: [err.message] } };
    if (err instanceof InvariantError) return { message: err.message };
    throw err;
  }
}

export async function toggleLoginAction(formData: FormData): Promise<void> {
  await requireStaff();
  const sellerId = String(formData.get("sellerId"));
  const enabled = formData.get("enabled") === "true";
  await setSellerLoginEnabled(db, sellerId, enabled);
  revalidatePath(`/admin/sellers/${sellerId}`);
}

export async function unlinkLoginAction(formData: FormData): Promise<void> {
  await requireStaff();
  const sellerId = String(formData.get("sellerId"));
  await unlinkSellerLogin(db, sellerId);
  revalidatePath(`/admin/sellers/${sellerId}`);
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const userId = String(formData.get("userId"));
  const backTo = String(formData.get("backTo") ?? "");
  try {
    const { password } = await resetUserPassword(db, userId);
    if (backTo) revalidatePath(backTo);
    return { message: `New password (shown once): ${password}` };
  } catch (err) {
    if (err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
}
