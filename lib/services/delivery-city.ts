/**
 * The header's "Delivery to" city (docs/buyer-funnel-search.md section 6). It only
 * pre-fills the city at the reserve step; it never affects search or sorting. Node-safe.
 *
 * Two entry points hide everything else:
 *  - `resolveDeliveryLocation` says which city to show, and whether it is a choice or a guess.
 *  - `chooseDeliveryCity` records what the visitor typed and says what the browser cookie should hold.
 *
 * A city the visitor chose always wins over a guess. The guess from the IP address is
 * never stored: only a city the visitor chose is ever written down.
 */
import type { PrismaClient } from "@prisma/client";
import { isBuyer, type Actor } from "../dal/actor";
import { blankToNull } from "../text";

export const MAX_CITY_LENGTH = 80;

export type CitySource = "chosen" | "detected";

export interface DeliveryLocation {
  city: string | null;
  /** "chosen" for a city the visitor picked, "detected" for a guess, null when there is none. */
  source: CitySource | null;
}

/**
 * Which city to show in the header.
 *
 * Order: the signed-in buyer's saved city, then the city chosen in this browser
 * (`cookieCity`), then a guess. The guess is the city in Vercel's IP header, or
 * `fallbackCity` when the header is missing or unreadable (development has no header).
 */
export async function resolveDeliveryLocation(
  db: PrismaClient,
  input: {
    actor: Actor | null;
    cookieCity: string | null | undefined;
    /** Vercel's `x-vercel-ip-city`: URL-encoded, city-level and often wrong. */
    ipCityHeader: string | null | undefined;
    fallbackCity: string | null | undefined;
  },
): Promise<DeliveryLocation> {
  const chosen = blankToNull(await savedCity(db, input.actor)) ?? blankToNull(input.cookieCity);
  if (chosen) return { city: chosen, source: "chosen" };

  const detected = decodeCity(input.ipCityHeader) ?? blankToNull(input.fallbackCity);
  if (detected) return { city: detected, source: "detected" };

  return { city: null, source: null };
}

/**
 * Record the city a visitor typed in the header control and return what the browser
 * cookie should now hold, null meaning "remove the cookie". Blank clears the choice.
 * Over-long input is cut to the limit. A signed-in buyer's city is also saved on their
 * account; anyone else only gets the cookie.
 */
export async function chooseDeliveryCity(
  db: PrismaClient,
  actor: Actor | null,
  rawCity: string,
): Promise<string | null> {
  const city = blankToNull(rawCity.trim().slice(0, MAX_CITY_LENGTH));
  if (actor && isBuyer(actor)) {
    await db.buyer.update({ where: { id: actor.buyerId! }, data: { deliveryCity: city } });
  }
  return city;
}

/** The buyer's saved city; null for anonymous visitors and non-buyer roles. */
async function savedCity(db: PrismaClient, actor: Actor | null): Promise<string | null> {
  if (!actor || !isBuyer(actor)) return null;
  const buyer = await db.buyer.findUnique({ where: { id: actor.buyerId! }, select: { deliveryCity: true } });
  return buyer?.deliveryCity ?? null;
}

function decodeCity(raw: string | null | undefined): string | null {
  const trimmed = blankToNull(raw);
  if (!trimmed) return null;
  try {
    return blankToNull(decodeURIComponent(trimmed));
  } catch {
    return null;
  }
}
