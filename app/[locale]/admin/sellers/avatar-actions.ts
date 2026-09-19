"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { blobPhotoStore } from "@/lib/storage";
import { setSellerAvatar, removeSellerAvatar } from "@/lib/services/photos";
import { readPhoto, photoErrorMessage } from "../_lib/photo-upload";
import type { AuthFormState } from "../../register/actions";

export async function uploadSellerAvatarAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const sellerId = String(formData.get("sellerId"));
  const image = await readPhoto(formData);
  if ("error" in image) return { message: image.error };

  try {
    await setSellerAvatar(db, blobPhotoStore, { sellerId, image });
  } catch (err) {
    return { message: photoErrorMessage(err) };
  }
  revalidatePath("/admin/sellers/[id]", "page");
  return { message: "Uploaded" };
}

export async function removeSellerAvatarAction(formData: FormData): Promise<void> {
  await requireStaff();
  await removeSellerAvatar(db, blobPhotoStore, String(formData.get("sellerId")));
  revalidatePath("/admin/sellers/[id]", "page");
}
