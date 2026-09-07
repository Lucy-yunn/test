"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { InvariantError, NotFoundError } from "@/lib/dal";
import {
  createPart,
  updatePart,
  setPartStatus,
  addPartNumber,
  updatePartNumber,
  removePartNumber,
} from "@/lib/services/parts";
import {
  newPartSchema,
  partSchema,
  partNumberSchema,
  parseAttributesJson,
} from "@/lib/validation/parts";
import type { AuthFormState } from "../../register/actions";

function fieldErrors(err: z.ZodError): AuthFormState {
  return { errors: z.flattenError(err).fieldErrors };
}

export async function createPartAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const parsed = newPartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  let attributes: unknown;
  try {
    attributes = parseAttributesJson(parsed.data.attributesJson);
  } catch (e) {
    return { errors: { attributesJson: [(e as Error).message] } };
  }

  let created: { internalCode: string };
  try {
    const part = await createPart(db, {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      notes: parsed.data.notes,
      attributes,
    });
    created = part;
    if (parsed.data.firstNumber) {
      await addPartNumber(db, {
        partId: part.id,
        raw: parsed.data.firstNumber,
        numberType: parsed.data.firstNumberType ?? "oem",
        isPrimary: true,
      });
    }
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) {
      return { message: err.message };
    }
    throw err;
  }

  revalidatePath("/admin/parts");
  redirect(`/admin/parts/${created.internalCode}`);
}

export async function updatePartAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const partId = String(formData.get("partId"));
  const parsed = partSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  let attributes: unknown;
  try {
    attributes = parseAttributesJson(parsed.data.attributesJson);
  } catch (e) {
    return { errors: { attributesJson: [(e as Error).message] } };
  }

  try {
    await updatePart(db, partId, {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      notes: parsed.data.notes,
      attributes,
    });
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) {
      return { message: err.message };
    }
    throw err;
  }
  revalidatePath(`/admin/parts`);
  return { message: "Saved" };
}

export async function confirmPartAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setPartStatus(db, String(formData.get("partId")), "confirmed");
  revalidatePath("/admin/parts");
}

export async function addPartNumberAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const partId = String(formData.get("partId"));
  const parsed = partNumberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  try {
    const { conflict } = await addPartNumber(db, {
      partId,
      raw: parsed.data.raw,
      numberType: parsed.data.numberType,
      brand: parsed.data.brand,
      isPrimary: parsed.data.isPrimary === "on",
      verified: parsed.data.verified === "on",
    });
    revalidatePath(`/admin/parts`);
    return conflict
      ? {
          message: `Added. Note: ${conflict.internalCode} already carries this number — merge if they are the same part.`,
        }
      : { message: "Added" };
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) {
      return { errors: { raw: [err.message] } };
    }
    throw err;
  }
}

export async function togglePartNumberFlagAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  const next = formData.get("next") === "true";
  await updatePartNumber(
    db,
    id,
    field === "isPrimary" ? { isPrimary: next } : { verified: next },
  );
  revalidatePath("/admin/parts");
}

export async function removePartNumberAction(formData: FormData): Promise<void> {
  await requireStaff();
  await removePartNumber(db, String(formData.get("id")));
  revalidatePath("/admin/parts");
}
