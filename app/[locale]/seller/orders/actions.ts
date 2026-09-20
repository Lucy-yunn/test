"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/dal/session";
import { ForbiddenError, InvariantError, NotFoundError } from "@/lib/dal";
import { approveCancellation, completeOrder, confirmOrder, refuseOrder } from "@/lib/services/orders";
import type { AuthFormState } from "../../register/actions";

/**
 * The seller's buttons on an order. Staff never reach these: requireSeller refuses them, and
 * every service function checks that the order belongs to this seller.
 */
async function run(formData: FormData, act: (sellerActor: Awaited<ReturnType<typeof requireSeller>>, orderId: string) => Promise<void>): Promise<AuthFormState> {
  const actor = await requireSeller();
  try {
    await act(actor, String(formData.get("orderId")));
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      return { message: err.message };
    }
    throw err;
  }
  // The list, the order page and the overview figures all change with an order.
  revalidatePath("/seller", "layout");
  return undefined;
}

export async function confirmOrderAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (actor, id) => confirmOrder(db, actor, id));
}

export async function completeOrderAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (actor, id) => completeOrder(db, actor, id));
}

export async function refuseOrderAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (actor, id) => refuseOrder(db, actor, id, { note: String(formData.get("note") ?? "") }));
}

export async function approveCancellationAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (actor, id) => approveCancellation(db, actor, id));
}
