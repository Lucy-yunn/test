"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { NotFoundError } from "@/lib/dal";
import { resetUserPassword } from "@/lib/services/sellers";
import type { AuthFormState } from "../../register/actions";

export async function resetBuyerPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const userId = String(formData.get("userId"));
  try {
    const { password } = await resetUserPassword(db, userId);
    revalidatePath(`/admin/buyers`);
    return { message: `New password (shown once): ${password}` };
  } catch (err) {
    if (err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
}
