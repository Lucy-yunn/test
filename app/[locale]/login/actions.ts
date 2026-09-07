"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { auth } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";
import { roleHomePath, type Role } from "@/lib/dal";
import type { AuthFormState } from "../register/actions";

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }
  const { email, password, redirectTo } = parsed.data;

  let role: Role;
  try {
    const res = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
    role = ((res.user as { role?: Role }).role ?? "buyer") as Role;
  } catch {
    return { message: "Incorrect email or password" };
  }

  redirect(roleHomePath(role, redirectTo ?? null));
}

export async function logoutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
