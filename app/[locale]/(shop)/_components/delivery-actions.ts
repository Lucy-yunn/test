"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { InvariantError } from "@/lib/dal";
import { setDeliveryCity, MAX_CITY_LENGTH } from "@/lib/services/delivery-city";
import { DELIVERY_CITY_COOKIE } from "./delivery-cookie";

/**
 * The header's "Delivery to" control. Only a city the visitor typed is stored:
 * in a cookie for anyone, and on their Buyer profile when they are a signed-in
 * buyer. The IP-detected suggestion is never stored. Blank clears the choice.
 */
export async function setDeliveryCityAction(formData: FormData): Promise<void> {
  const city = String(formData.get("city") ?? "").trim().slice(0, MAX_CITY_LENGTH);

  const actor = await getActor();
  if (actor?.role === "buyer") {
    try {
      await setDeliveryCity(db, actor, city);
    } catch (err) {
      if (!(err instanceof InvariantError)) throw err;
    }
  }

  const jar = await cookies();
  if (city) {
    jar.set(DELIVERY_CITY_COOKIE, city, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    jar.delete(DELIVERY_CITY_COOKIE);
  }
  revalidatePath("/", "layout");
}
