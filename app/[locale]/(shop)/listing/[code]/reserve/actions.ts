"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { InvariantError, NotFoundError } from "@/lib/dal";
import { reserveListing } from "@/lib/services/orders";
import type { AuthFormState } from "@/app/[locale]/register/actions";

const reserveSchema = z.object({
  listingCode: z.string().min(1),
  recipientName: z.string().trim().min(1, "Enter the recipient's name"),
  phone: z.string().trim().min(1, "Enter a phone number"),
  addressLine1: z.string().trim().min(1, "Enter the street address"),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "Enter the city"),
  postcode: z.string().trim().min(1, "Enter the postcode"),
  country: z.string().trim().optional(),
});

/** The confirmation page's button: places the order, then shows it to the buyer. */
export async function reserveAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const parsed = reserveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { listingCode, ...address } = parsed.data;

  let orderCode: string;
  try {
    ({ internalCode: orderCode } = await reserveListing(db, actor, { listingCode, address }));
  } catch (err) {
    if (err instanceof InvariantError || err instanceof NotFoundError) return { message: err.message };
    throw err;
  }
  redirect(`/account/orders/${orderCode}`);
}
