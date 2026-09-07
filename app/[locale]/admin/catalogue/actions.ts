"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { ConflictError, NotFoundError } from "@/lib/dal";
import {
  addMake,
  addModelGroup,
  addGeneration,
  setCatalogueRowActive,
  type CatalogueModel,
} from "@/lib/services/vehicle-catalogue";
import {
  makeSchema,
  modelGroupSchema,
  generationSchema,
} from "@/lib/validation/admin";
import type { AuthFormState } from "../../register/actions";

const PATH = "/admin/catalogue";

function fail(err: unknown): AuthFormState {
  if (err instanceof ConflictError || err instanceof NotFoundError) {
    return { message: err.message };
  }
  throw err;
}

export async function addMakeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const parsed = makeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await addMake(db, parsed.data);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(PATH);
  return { message: "Make added" };
}

export async function addModelGroupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const parsed = modelGroupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  try {
    await addModelGroup(db, parsed.data);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(PATH);
  return { message: "Model group added" };
}

export async function addGenerationAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const parsed = generationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { chassisCodes, ...rest } = parsed.data;
  try {
    await addGeneration(db, {
      ...rest,
      chassisCodes: chassisCodes
        ? chassisCodes.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(PATH);
  return { message: "Generation added" };
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  await requireStaff();
  const model = String(formData.get("model")) as CatalogueModel;
  const id = String(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await setCatalogueRowActive(db, model, id, isActive);
  revalidatePath(PATH);
}
