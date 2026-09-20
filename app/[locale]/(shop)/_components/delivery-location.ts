import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { getActor } from "@/lib/dal/session";
import { resolveDeliveryLocation, type DeliveryLocation } from "@/lib/services/delivery-city";

/** Name of the cookie holding the city a visitor typed in the header's "Delivery to" control. */
export const DELIVERY_CITY_COOKIE = "ivo_city";

/**
 * The city to show for the current request. Only reads the request (who is signed in,
 * the cookie, Vercel's IP header); the rules live in `resolveDeliveryLocation`.
 * Vercel supplies the city header only when deployed, so development shows a demo city.
 */
export async function currentDeliveryLocation(): Promise<DeliveryLocation> {
  const [actor, jar, requestHeaders] = await Promise.all([getActor(), cookies(), headers()]);
  return resolveDeliveryLocation(db, {
    actor,
    cookieCity: jar.get(DELIVERY_CITY_COOKIE)?.value,
    ipCityHeader: requestHeaders.get("x-vercel-ip-city"),
    fallbackCity: process.env.NODE_ENV !== "production" ? "Aytos" : null,
  });
}
