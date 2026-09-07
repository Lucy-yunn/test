"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { signUpBuyer } from "@/lib/services/accounts";
import { registerSchema } from "@/lib/validation/auth";
import { ConflictError, roleHomePath } from "@/lib/dal";

export type AuthFormState =
  | { errors?: Record<string, string[] | undefined>; message?: string }
  | undefined;

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }
  const { email, password, name, redirectTo } = parsed.data;

  try {
    await signUpBuyer(db, { email, password, name });
  } catch (err) {
    if (err instanceof ConflictError) {
      return { errors: { email: [err.message] } };
    }
    throw err;
  }

  await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  redirect(roleHomePath("buyer", redirectTo ?? null));
}
