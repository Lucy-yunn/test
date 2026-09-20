"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { CancellationReason } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { ForbiddenError, InvariantError, NotFoundError } from "@/lib/dal";
import { cancelOrder } from "@/lib/services/orders";
import type { AuthFormState } from "../../register/actions";

const cancelSchema = z.object({
  orderId: z.string().min(1),
  orderCode: z.string().min(1),
  reason: z.enum(CancellationReason, "Choose a reason"),
  detail: z.string().trim().optional(),
});

export async function cancelOrderAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await requireBuyer();
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { orderId, orderCode, reason, detail } = parsed.data;

  try {
    await cancelOrder(db, actor, orderId, { reason, detail });
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      return { message: err.message };
    }
    throw err;
  }
  revalidatePath(`/account/orders/${orderCode}`);
  redirect(`/account/orders/${orderCode}`);
}
