"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { chooseDeliveryCity } from "@/lib/services/delivery-city";
import { DELIVERY_CITY_COOKIE } from "./delivery-location";

/**
 * The header's "Delivery to" control. Only a city the visitor typed is stored:
 * in a cookie for anyone, and on their Buyer profile when they are a signed-in
 * buyer. The IP-detected suggestion is never stored. Blank clears the choice.
 */
export async function setDeliveryCityAction(formData: FormData): Promise<void> {
  const city = await chooseDeliveryCity(db, await getActor(), String(formData.get("city") ?? ""));

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
