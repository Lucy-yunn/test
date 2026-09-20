import type { PrismaClient } from "@prisma/client";
import type { Actor } from "../dal/actor";
import {
  SELLER_AVAILABILITY_SELECT,
  sellerIsAvailable,
  type SellerLoginState,
} from "../dal/seller-availability";
import { blankToNull, firstLine } from "../text";
import { maskVin } from "./listing-detail";
import { sellerContactFor, type SellerContact } from "./seller-contact";

/**
 * The public seller profile (docs/seller-profile.md). Node-safe.
 */

export interface SellerProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  city: string;
  country: string;
  lastActiveAt: Date | null;
  /** What the viewer may see of the seller's contact (ADR-0011). */
  contact: SellerContact;
  /** Earliest publish date across the seller's listings. */
  onIvoSince: Date;
}

/**
 * A seller has a public profile only when it is available (an active login, auth §4.4)
 * and has published at least one listing. This is the one place that says so: the profile,
 * the donor-vehicle page and the saved-sellers list all decide through it.
 */
export function sellerHasPublicProfile(
  seller: SellerLoginState & { listings: readonly unknown[] },
): boolean {
  return sellerIsAvailable(seller) && seller.listings.length > 0;
}

/**
 * `viewer` is the signed-in Actor or null; it only decides whether the phone number is
 * returned (via sellerContactFor). One read: the seller, its login state and its earliest
 * publish date are selected together instead of in three separate calls.
 */
export async function getSellerProfile(
  db: PrismaClient,
  sellerId: string,
  viewer: Actor | null = null,
): Promise<SellerProfile | null> {
  const seller = await db.seller.findUnique({
    relationLoadStrategy: "join",
    where: { id: sellerId },
    select: {
      displayName: true,
      avatarUrl: true,
      locationCity: true,
      locationCountry: true,
      lastActiveAt: true,
      contactPhone: true,
      ...SELLER_AVAILABILITY_SELECT,
      listings: {
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "asc" },
        take: 1,
        select: { publishedAt: true },
      },
    },
  });
  if (!seller || !sellerHasPublicProfile(seller)) return null;

  return {
    id: sellerId,
    name: seller.displayName,
    avatarUrl: seller.avatarUrl,
    city: seller.locationCity,
    country: seller.locationCountry,
    lastActiveAt: seller.lastActiveAt,
    contact: sellerContactFor(viewer, seller.contactPhone),
    onIvoSince: seller.listings[0].publishedAt as Date,
  };
}

export type MileageBand = "under100k" | "100to200k" | "over200k";

export const MILEAGE_BANDS: { value: MileageBand; label: string }[] = [
  { value: "under100k", label: "Under 100,000 km" },
  { value: "100to200k", label: "100,000 – 200,000 km" },
  { value: "over200k", label: "Over 200,000 km" },
];

/** A car with unknown mileage never matches a band. */
export function matchesMileageBand(km: number | null, band: MileageBand): boolean {
  if (km == null) return false;
  if (band === "under100k") return km < 100_000;
  if (band === "100to200k") return km >= 100_000 && km <= 200_000;
  return km > 200_000;
}

export function parseMileageBand(value: string | undefined): MileageBand | undefined {
  return MILEAGE_BANDS.find((b) => b.value === value)?.value;
}

// ---------------------------------------------------------------------------
// All Cars tab (docs/seller-profile.md §4)
// ---------------------------------------------------------------------------

const SHELF = ["published", "reserved"] as const;
const VISIBLE_ON_CAR_PAGE = ["published", "reserved", "sold"] as const;

export type SellerCarSort = "newest" | "most_parts";

export interface SellerCarsOptions {
  /** VehicleMake slug */
  make?: string;
  /** VehicleGeneration slug */
  generation?: string;
  fuel?: string;
  mileage?: MileageBand;
  /** Only cars with at least one part on the shelf. */
  onShelfOnly?: boolean;
  sort?: SellerCarSort;
}

export interface SellerCar {
  id: string;
  makeName: string;
  modelGroupName: string;
  generationLabel: string;
  year: number | null;
  engine: string | null;
  fuel: string | null;
  transmission: string | null;
  mileageKm: number | null;
  scrapReasonFirstLine: string | null;
  photoUrl: string | null;
  /** Listings in published or reserved. */
  onShelf: number;
  sold: number;
}

export interface SellerCarsResult {
  cars: SellerCar[];
  total: number;
  /** Filter choices drawn from every visible car of the seller, not only the filtered ones. */
  facets: {
    makes: { slug: string; name: string }[];
    generations: { slug: string; label: string }[];
    fuels: string[];
  };
}

/**
 * A seller's donor vehicles that have at least one part on the shelf or sold. A car
 * with only drafts, cancelled or archived parts is hidden.
 */
export async function listSellerCars(
  db: PrismaClient,
  sellerId: string,
  options: SellerCarsOptions,
): Promise<SellerCarsResult> {
  const donors = await db.donorVehicle.findMany({
    relationLoadStrategy: "join",
    where: { sellerId, listings: { some: { status: { in: [...VISIBLE_ON_CAR_PAGE] } } } },
    select: {
      id: true,
      donorYear: true,
      engine: true,
      fuel: true,
      transmission: true,
      mileageKm: true,
      scrapReason: true,
      photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
      generation: {
        select: {
          slug: true,
          label: true,
          modelGroup: { select: { name: true, make: { select: { slug: true, name: true } } } },
        },
      },
      listings: {
        where: { status: { in: [...VISIBLE_ON_CAR_PAGE] } },
        orderBy: { publishedAt: "desc" },
        select: {
          status: true,
          publishedAt: true,
          photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  });

  const all = donors.map((d) => {
    const onShelf = d.listings.filter((l) => (SHELF as readonly string[]).includes(l.status)).length;
    return {
      car: {
        id: d.id,
        makeName: d.generation.modelGroup.make.name,
        modelGroupName: d.generation.modelGroup.name,
        generationLabel: d.generation.label,
        year: d.donorYear,
        engine: d.engine,
        fuel: d.fuel,
        transmission: d.transmission,
        mileageKm: d.mileageKm,
        scrapReasonFirstLine: firstLine(d.scrapReason),
        photoUrl: d.photos[0]?.url ?? d.listings.find((l) => l.photos[0])?.photos[0]?.url ?? null,
        onShelf,
        sold: d.listings.filter((l) => l.status === "sold").length,
      } satisfies SellerCar,
      makeSlug: d.generation.modelGroup.make.slug,
      generationSlug: d.generation.slug,
      latest: d.listings[0]?.publishedAt?.getTime() ?? 0,
    };
  });

  const kept = all.filter(
    (x) =>
      (!options.make || x.makeSlug === options.make) &&
      (!options.generation || x.generationSlug === options.generation) &&
      (!options.fuel || x.car.fuel === options.fuel) &&
      (!options.mileage || matchesMileageBand(x.car.mileageKm, options.mileage)) &&
      (!options.onShelfOnly || x.car.onShelf > 0),
  );

  kept.sort((a, b) =>
    options.sort === "most_parts" && b.car.onShelf !== a.car.onShelf ? b.car.onShelf - a.car.onShelf : b.latest - a.latest,
  );

  const uniq = <T>(items: T[], key: (t: T) => string) => [...new Map(items.map((i) => [key(i), i])).values()];
  return {
    cars: kept.map((x) => x.car),
    total: kept.length,
    facets: {
      makes: uniq(
        all.map((x) => ({ slug: x.makeSlug, name: x.car.makeName })),
        (m) => m.slug,
      ).sort((a, b) => a.name.localeCompare(b.name)),
      generations: uniq(
        all.map((x) => ({ slug: x.generationSlug, label: x.car.generationLabel })),
        (g) => g.slug,
      ).sort((a, b) => a.label.localeCompare(b.label)),
      fuels: [...new Set(all.map((x) => x.car.fuel).filter((f): f is string => !!f))].sort(),
    },
  };
}

// ---------------------------------------------------------------------------
// Donor-vehicle page (docs/seller-profile.md section 6)
// ---------------------------------------------------------------------------

export type CarPartState = "available" | "reserved" | "sold";

export interface DonorVehiclePart {
  code: string;
  title: string;
  priceEur: string;
  photoUrl: string | null;
  condition: string;
  state: CarPartState;
}

export interface DonorVehiclePage {
  id: string;
  makeName: string;
  modelGroupName: string;
  generationLabel: string;
  year: number | null;
  maskedVin: string | null;
  mileageKm: number | null;
  registrationCountry: string | null;
  engine: string | null;
  engineCode: string | null;
  fuel: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  /** Full free text, in the seller own words. */
  scrapReason: string | null;
  photos: { url: string; caption: string | null }[];
  seller: { id: string; name: string; avatarUrl: string | null; city: string };
  /** On the shelf first (reserved among them), sold last. Newest first within each group. */
  parts: DonorVehiclePart[];
}

/**
 * The car ID card and every part taken from it. Hidden (null) when the car is unknown,
 * has no published, reserved or sold part, or its seller is not available. Draft,
 * cancelled and archived parts never show. Staff-only VIN notes and the full VIN are
 * never returned.
 */
export async function getDonorVehiclePage(
  db: PrismaClient,
  donorVehicleId: string,
): Promise<DonorVehiclePage | null> {
  const d = await db.donorVehicle.findUnique({
    relationLoadStrategy: "join",
    where: { id: donorVehicleId },
    select: {
      id: true,
      donorYear: true,
      vin: true,
      mileageKm: true,
      registrationCountry: true,
      engine: true,
      engineCode: true,
      fuel: true,
      transmission: true,
      bodyStyle: true,
      drivetrain: true,
      scrapReason: true,
      photos: { orderBy: { displayOrder: "asc" }, select: { url: true, caption: true } },
      generation: {
        select: { label: true, modelGroup: { select: { name: true, make: { select: { name: true } } } } },
      },
      seller: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          locationCity: true,
          ...SELLER_AVAILABILITY_SELECT,
        },
      },
      listings: {
        where: { status: { in: [...VISIBLE_ON_CAR_PAGE] } },
        orderBy: { publishedAt: "desc" },
        select: {
          internalCode: true,
          status: true,
          priceEur: true,
          condition: true,
          part: { select: { name: true } },
          photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  });
  if (!d || !sellerIsAvailable(d.seller) || d.listings.length === 0) return null;

  const toPart = (l: (typeof d.listings)[number]): DonorVehiclePart => ({
    code: l.internalCode,
    title: l.part.name,
    priceEur: String(l.priceEur),
    photoUrl: l.photos[0]?.url ?? null,
    condition: l.condition,
    state: l.status === "sold" ? "sold" : l.status === "reserved" ? "reserved" : "available",
  });
  const onShelf = d.listings.filter((l) => l.status !== "sold").map(toPart);
  const sold = d.listings.filter((l) => l.status === "sold").map(toPart);

  return {
    id: d.id,
    makeName: d.generation.modelGroup.make.name,
    modelGroupName: d.generation.modelGroup.name,
    generationLabel: d.generation.label,
    year: d.donorYear,
    maskedVin: maskVin(d.vin),
    mileageKm: d.mileageKm,
    registrationCountry: d.registrationCountry,
    engine: d.engine,
    engineCode: d.engineCode,
    fuel: d.fuel,
    transmission: d.transmission,
    bodyStyle: d.bodyStyle,
    drivetrain: d.drivetrain,
    scrapReason: blankToNull(d.scrapReason),
    photos: d.photos,
    seller: {
      id: d.seller.id,
      name: d.seller.displayName,
      avatarUrl: d.seller.avatarUrl,
      city: d.seller.locationCity,
    },
    parts: [...onShelf, ...sold],
  };
}
