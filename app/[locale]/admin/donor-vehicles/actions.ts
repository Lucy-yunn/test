"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { NotFoundError } from "@/lib/dal";
import {
  createDonorVehicle,
  updateDonorVehicle,
} from "@/lib/services/donor-vehicles";
import { donorVehicleSchema } from "@/lib/validation/intake";
import type { AuthFormState } from "../../register/actions";

export async function createDonorVehicleAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireStaff();
  const parsed = donorVehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  try {
    const { id } = await createDonorVehicle(db, parsed.data, actor.userId);
    revalidatePath("/admin/donor-vehicles");
    redirect(`/admin/donor-vehicles/${id}`);
  } catch (err) {
    if (err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
}

export async function updateDonorVehicleAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const id = String(formData.get("id"));
  const parsed = donorVehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  try {
    await updateDonorVehicle(db, id, parsed.data);
  } catch (err) {
    if (err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/donor-vehicles/${id}`);
  return { message: "Saved" };
}
