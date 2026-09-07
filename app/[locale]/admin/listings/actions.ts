"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/dal/session";
import { InvariantError, NotFoundError } from "@/lib/dal";
import {
  createListing,
  updateListing,
  addListingDefect,
  removeListingDefect,
  publishListing,
  setListingStatusByStaff,
} from "@/lib/services/listings";
import { listingSchema, defectSchema } from "@/lib/validation/intake";
import type { AuthFormState } from "../../register/actions";

function toInput(d: z.infer<typeof listingSchema>) {
  return {
    partId: d.partId,
    priceEur: d.priceEur,
    condition: d.condition,
    conditionNotes: d.conditionNotes,
    removalNotes: d.removalNotes,
    negotiable: d.negotiable === "on",
    noVisiblePartNumber: d.noVisiblePartNumber === "on",
    sellerSku: d.sellerSku,
    warehouseLocation: d.warehouseLocation,
    lengthCm: d.lengthCm,
    widthCm: d.widthCm,
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    packageSizeNotes: d.packageSizeNotes,
  };
}

export async function createListingAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireStaff();
  const donorVehicleId = String(formData.get("donorVehicleId"));
  const parsed = listingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  try {
    const { internalCode } = await createListing(
      db,
      { donorVehicleId, ...toInput(parsed.data) },
      actor.userId,
    );
    redirect(`/admin/listings/${internalCode}`);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof InvariantError) {
      return { message: err.message };
    }
    throw err;
  }
}

export async function updateListingAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const listingId = String(formData.get("listingId"));
  const parsed = listingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  try {
    await updateListing(db, listingId, toInput(parsed.data));
  } catch (err) {
    if (err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/listings");
  return { message: "Saved" };
}

export async function addDefectAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireStaff();
  const listingId = String(formData.get("listingId"));
  const parsed = defectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  await addListingDefect(db, listingId, parsed.data.description);
  revalidatePath("/admin/listings");
  return { message: "Added" };
}

export async function removeDefectAction(formData: FormData): Promise<void> {
  await requireStaff();
  await removeListingDefect(db, String(formData.get("id")));
  revalidatePath("/admin/listings");
}

export async function publishListingAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireStaff();
  try {
    await publishListing(db, String(formData.get("listingId")), actor.userId);
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) {
      return { message: err.message };
    }
    throw err;
  }
  revalidatePath("/admin/listings");
  return { message: "Published" };
}

export async function setListingStatusAction(formData: FormData): Promise<void> {
  await requireStaff();
  const to = String(formData.get("to")) as
    | "published"
    | "cancelled"
    | "archived";
  await setListingStatusByStaff(db, String(formData.get("listingId")), to);
  revalidatePath("/admin/listings");
}
