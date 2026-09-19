/**
 * The header's "Delivery to" city (docs/buyer-funnel-search.md §6). It only pre-fills
 * the city at the reserve step; it never affects search or sorting. Node-safe.
 *
 * A city the buyer chose always wins over a guess. The IP-derived guess is never
 * stored: only a city the buyer chose is ever written to the database.
 */
import type { PrismaClient } from "@prisma/client";
import { isBuyer, type Actor } from "../dal/actor";
import { ForbiddenError, InvariantError } from "../dal/errors";

export const MAX_CITY_LENGTH = 80;

export type CitySource = "chosen" | "detected";

const clean = (s: string | null | undefined): string | null => s?.trim() || null;

/**
 * Vercel adds the visitor's city to each request as a URL-encoded header. It is
 * city-level and often wrong, so it is only a suggestion.
 */
export function parseDetectedCity(raw: string | null | undefined): string | null {
  const trimmed = clean(raw);
  if (!trimmed) return null;
  try {
    return clean(decodeURIComponent(trimmed));
  } catch {
    return null;
  }
}

export function resolveDeliveryCity(input: {
  savedCity: string | null;
  cookieCity: string | null;
  detectedCity: string | null;
}): { city: string | null; source: CitySource | null } {
  const chosen = clean(input.savedCity) ?? clean(input.cookieCity);
  if (chosen) return { city: chosen, source: "chosen" };
  const detected = clean(input.detectedCity);
  if (detected) return { city: detected, source: "detected" };
  return { city: null, source: null };
}

/** Save the city a buyer chose; blank clears it. Buyer accounts only. */
export async function setDeliveryCity(db: PrismaClient, actor: Actor, city: string): Promise<void> {
  if (!isBuyer(actor)) throw new ForbiddenError("Delivery city is for buyer accounts");
  const value = clean(city);
  if (value && value.length > MAX_CITY_LENGTH) {
    throw new InvariantError(`City must be at most ${MAX_CITY_LENGTH} characters`);
  }
  await db.buyer.update({ where: { id: actor.buyerId! }, data: { deliveryCity: value } });
}

/** The buyer's saved city, or null for anonymous visitors and non-buyer roles. */
export async function getSavedDeliveryCity(db: PrismaClient, actor: Actor | null): Promise<string | null> {
  if (!actor || !isBuyer(actor)) return null;
  const buyer = await db.buyer.findUnique({ where: { id: actor.buyerId! }, select: { deliveryCity: true } });
  return buyer?.deliveryCity ?? null;
}
