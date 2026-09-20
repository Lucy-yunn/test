import type { PrismaClient, Condition, Transmission } from "@prisma/client";
import type { Actor } from "../dal/actor";
import { SELLER_AVAILABILITY_SELECT, sellerIsAvailable } from "../dal/seller-availability";
import { sellerContactFor, type SellerContact } from "./seller-contact";

/**
 * Buyer listing-detail page + the "More parts from the same car" section
 * (docs/buyer-funnel-search.md §2, docs/donor-vehicle-parts.md). Node-safe.
 *
 * A listing is only served as a shopping page when its status is `published` or
 * `reserved` (#8). VIN is masked to buyers; `vinDerivedNotes` is never returned
 * here.
 */

const BUYER_VISIBLE: readonly string[] = ["published", "reserved"];

/** Show the first 3 and last 4 characters; mask the middle (#8 — VIN masked). */
export function maskVin(vin: string | null | undefined): string | null {
  const v = vin?.trim();
  if (!v) return null;
  if (v.length <= 7) return `${v[0] ?? ""}${"•".repeat(Math.max(0, v.length - 1))}`;
  return `${v.slice(0, 3)}${"•".repeat(v.length - 7)}${v.slice(-4)}`;
}

export interface ListingDetail {
  id: string;
  internalCode: string;
  status: string;
  title: string;
  priceEur: string;
  negotiable: boolean;
  condition: Condition;
  conditionNotes: string | null;
  removalNotes: string | null;
  photos: { url: string; caption: string | null }[];
  defects: string[];
  dimensions: { lengthCm: string | null; widthCm: string | null; heightCm: string | null; weightKg: string | null };
  part: {
    internalCode: string;
    name: string;
    categoryName: string;
    groupName: string;
    numbers: { raw: string; numberType: string; brand: string | null; isPrimary: boolean }[];
  };
  donor: {
    id: string;
    label: string;
    year: number | null;
    maskedVin: string | null;
    mileageKm: number | null;
    registrationCountry: string | null;
    engine: string | null;
    engineCode: string | null;
    fuel: string | null;
    transmission: Transmission | null;
    bodyStyle: string | null;
    drivetrain: string | null;
    makeName: string;
    modelGroupName: string;
    generationLabel: string;
  };
  seller: {
    id: string;
    name: string;
    avatarUrl: string | null;
    lastActiveAt: Date | null;
    city: string;
    country: string;
    /**
     * Whether the seller is available (an active, non-disabled login): the same rule as
     * the seller profile and publishing. When false the page shows the name as plain text,
     * with no link to a profile that would not exist, and no messaging.
     */
    available: boolean;
    /** What the viewer may see of the seller's contact (ADR-0011); the number itself only for a signed-in viewer. */
    contact: SellerContact;
  };
}

/**
 * `viewer` is the signed-in Actor, or null/omitted for an anonymous visitor. It only
 * decides whether the seller's phone number is returned (docs/seller-profile.md §3, via sellerContactFor).
 */
export async function getListingDetail(
  db: PrismaClient,
  internalCode: string,
  viewer: Actor | null = null,
): Promise<ListingDetail | null> {
  const l = await db.listing.findUnique({
    where: { internalCode },
    select: {
      id: true,
      internalCode: true,
      status: true,
      priceEur: true,
      negotiable: true,
      condition: true,
      conditionNotes: true,
      removalNotes: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
      weightKg: true,
      photos: { orderBy: { displayOrder: "asc" }, select: { url: true, caption: true } },
      defects: { orderBy: { displayOrder: "asc" }, select: { description: true } },
      part: {
        select: {
          internalCode: true,
          name: true,
          category: { select: { name: true, group: { select: { name: true } } } },
          partNumbers: {
            orderBy: [{ isPrimary: "desc" }, { normalized: "asc" }],
            select: { raw: true, numberType: true, brand: true, isPrimary: true },
          },
        },
      },
      donorVehicle: {
        select: {
          id: true,
          label: true,
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
          generation: {
            select: {
              label: true,
              modelGroup: { select: { name: true, make: { select: { name: true } } } },
            },
          },
        },
      },
      seller: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          lastActiveAt: true,
          locationCity: true,
          locationCountry: true,
          ...SELLER_AVAILABILITY_SELECT,
          contactPhone: true,
        },
      },
    },
  });

  if (!l || !BUYER_VISIBLE.includes(l.status)) return null;

  const g = l.donorVehicle.generation;
  return {
    id: l.id,
    internalCode: l.internalCode,
    status: l.status,
    title: l.part.name,
    priceEur: String(l.priceEur),
    negotiable: l.negotiable,
    condition: l.condition,
    conditionNotes: l.conditionNotes,
    removalNotes: l.removalNotes,
    photos: l.photos,
    defects: l.defects.map((d) => d.description),
    dimensions: {
      lengthCm: l.lengthCm != null ? String(l.lengthCm) : null,
      widthCm: l.widthCm != null ? String(l.widthCm) : null,
      heightCm: l.heightCm != null ? String(l.heightCm) : null,
      weightKg: l.weightKg != null ? String(l.weightKg) : null,
    },
    part: {
      internalCode: l.part.internalCode,
      name: l.part.name,
      categoryName: l.part.category.name,
      groupName: l.part.category.group.name,
      numbers: l.part.partNumbers,
    },
    donor: {
      id: l.donorVehicle.id,
      label: l.donorVehicle.label,
      year: l.donorVehicle.donorYear,
      maskedVin: maskVin(l.donorVehicle.vin),
      mileageKm: l.donorVehicle.mileageKm,
      registrationCountry: l.donorVehicle.registrationCountry,
      engine: l.donorVehicle.engine,
      engineCode: l.donorVehicle.engineCode,
      fuel: l.donorVehicle.fuel,
      transmission: l.donorVehicle.transmission,
      bodyStyle: l.donorVehicle.bodyStyle,
      drivetrain: l.donorVehicle.drivetrain,
      makeName: g.modelGroup.make.name,
      modelGroupName: g.modelGroup.name,
      generationLabel: g.label,
    },
    seller: {
      id: l.seller.id,
      name: l.seller.displayName,
      avatarUrl: l.seller.avatarUrl,
      lastActiveAt: l.seller.lastActiveAt,
      city: l.seller.locationCity,
      country: l.seller.locationCountry,
      available: sellerIsAvailable(l.seller),
      contact: sellerContactFor(viewer, l.seller.contactPhone),
    },
  };
}

export interface SiblingCard {
  internalCode: string;
  title: string;
  priceEur: string;
  condition: Condition;
  status: string;
  photoUrl: string | null;
  photoCount: number;
}

/**
 * "More parts from the same car" — other buyer-visible listings sharing the
 * donor vehicle, newest first. Returns ALL of them; the page renders 8 + "See
 * all". Same-seller is guaranteed by the sellerId == donorVehicle.sellerId
 * invariant.
 */
export async function getSiblingListings(
  db: PrismaClient,
  args: { donorVehicleId: string; excludeListingId: string },
): Promise<SiblingCard[]> {
  const rows = await db.listing.findMany({
    where: {
      donorVehicleId: args.donorVehicleId,
      id: { not: args.excludeListingId },
      status: { in: ["published", "reserved"] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      internalCode: true,
      priceEur: true,
      condition: true,
      status: true,
      part: { select: { name: true } },
      photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
      _count: { select: { photos: true } },
    },
  });
  return rows.map((r) => ({
    internalCode: r.internalCode,
    title: r.part.name,
    priceEur: String(r.priceEur),
    condition: r.condition,
    status: r.status,
    photoUrl: r.photos[0]?.url ?? null,
    photoCount: r._count.photos,
  }));
}
