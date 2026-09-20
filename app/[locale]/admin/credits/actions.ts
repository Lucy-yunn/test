"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { InvariantError, NotFoundError } from "@/lib/dal";
import { createBundle, updateBundle, topUp, adjustCredits } from "@/lib/services/credits";
import { bundleSchema, topUpSchema, adjustSchema } from "@/lib/validation/credits";
import type { AuthFormState } from "../../register/actions";

/** Turn a refusal the person can fix into a form message; anything else is a real error. */
function refusal(err: unknown): AuthFormState {
  if (err instanceof InvariantError || err instanceof NotFoundError) return { message: err.message };
  throw err;
}

export async function createBundleAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await requireStaff();
  const parsed = bundleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await createBundle(db, parsed.data);
  } catch (err) {
    return refusal(err);
  }
  revalidatePath("/admin/credits");
  return { message: "Bundle added" };
}

export async function updateBundleAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await requireStaff();
  const parsed = bundleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await updateBundle(db, String(formData.get("bundleId")), parsed.data);
  } catch (err) {
    return refusal(err);
  }
  revalidatePath("/admin/credits");
  return { message: "Saved" };
}

export async function setBundleActiveAction(formData: FormData): Promise<void> {
  await requireStaff();
  await updateBundle(db, String(formData.get("bundleId")), { isActive: formData.get("active") === "true" });
  revalidatePath("/admin/credits");
}

export async function topUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireStaff();
  const parsed = topUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await topUp(db, { ...parsed.data, createdBy: actor.userId });
  } catch (err) {
    return refusal(err);
  }
  revalidatePath(`/admin/sellers/${parsed.data.sellerId}`);
  return { message: "Credits added" };
}

export async function adjustCreditsAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireStaff();
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await adjustCredits(db, { ...parsed.data, createdBy: actor.userId });
  } catch (err) {
    return refusal(err);
  }
  revalidatePath(`/admin/sellers/${parsed.data.sellerId}`);
  return { message: "Adjustment saved" };
}
