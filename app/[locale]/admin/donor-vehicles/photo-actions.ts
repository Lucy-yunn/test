"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { blobPhotoStore } from "@/lib/storage";
import {
  addDonorVehiclePhoto,
  removeDonorVehiclePhoto,
} from "@/lib/services/photos";
import { readPhoto, photoErrorMessage } from "../_lib/photo-upload";
import type { AuthFormState } from "../../register/actions";

export async function uploadDonorPhotoAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const donorVehicleId = String(formData.get("donorVehicleId"));
  const image = await readPhoto(formData);
  if ("error" in image) return { message: image.error };

  try {
    await addDonorVehiclePhoto(db, blobPhotoStore, { donorVehicleId, image });
  } catch (err) {
    return { message: photoErrorMessage(err) };
  }
  revalidatePath("/admin/donor-vehicles");
  return { message: "Uploaded" };
}

export async function removeDonorPhotoAction(formData: FormData): Promise<void> {
  await requireStaff();
  await removeDonorVehiclePhoto(db, blobPhotoStore, String(formData.get("id")));
  revalidatePath("/admin/donor-vehicles");
}
