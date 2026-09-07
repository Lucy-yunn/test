"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { blobPhotoStore } from "@/lib/storage";
import {
  addListingPhoto,
  removeListingPhoto,
  moveListingPhoto,
} from "@/lib/services/photos";
import { readPhoto, photoErrorMessage } from "../_lib/photo-upload";
import type { AuthFormState } from "../../register/actions";

export async function uploadListingPhotoAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const listingId = String(formData.get("listingId"));
  const image = await readPhoto(formData);
  if ("error" in image) return { message: image.error };

  try {
    await addListingPhoto(db, blobPhotoStore, { listingId, image });
  } catch (err) {
    return { message: photoErrorMessage(err) };
  }
  revalidatePath("/admin/listings");
  return { message: "Uploaded" };
}

export async function removeListingPhotoAction(formData: FormData): Promise<void> {
  await requireStaff();
  await removeListingPhoto(db, blobPhotoStore, String(formData.get("id")));
  revalidatePath("/admin/listings");
}

export async function moveListingPhotoAction(formData: FormData): Promise<void> {
  await requireStaff();
  await moveListingPhoto(
    db,
    String(formData.get("id")),
    formData.get("direction") === "up" ? "up" : "down",
  );
  revalidatePath("/admin/listings");
}
