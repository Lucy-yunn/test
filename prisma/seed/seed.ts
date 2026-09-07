/**
 * Demo seed logic — build step 1 (docs/spec/README.md §6, docs/spec/seed-data.md).
 *
 * A fully fictional dataset: no real people, no real transactions. Idempotent by
 * wipe-then-insert.
 *
 * This module is NODE-SAFE: it must not import `lib/auth.ts`, `lib/env.ts`, or
 * anything that reaches `server-only` / a Next-only module, because `prisma db seed`
 * runs `prisma/seed.ts` in a plain Node process outside Next.js. Password hashing
 * uses `better-auth/crypto` directly — the same scheme Better Auth's default
 * email/password verifier uses, so seeded accounts sign in normally.
 * `prisma/seed/seed.node-safety.test.ts` guards this boundary.
 */
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { GROUPS, CATEGORIES } from "./taxonomy";
import { MAKES, MODEL_GROUPS, GENERATIONS } from "./vehicles";

export const DEMO_PASSWORD = "demo-password-123";

export type SeedCounts = Record<string, number>;

type Role = "buyer" | "seller" | "staff";

async function wipe(db: PrismaClient) {
  // FK-safe order.
  await db.notification.deleteMany();
  await db.report.deleteMany();
  await db.message.deleteMany();
  await db.thread.deleteMany();
  await db.favorite.deleteMany();
  await db.cancellationRequest.deleteMany();
  await db.order.deleteMany();
  await db.listingDefect.deleteMany();
  await db.listingPhoto.deleteMany();
  await db.listing.deleteMany();
  await db.donorVehiclePhoto.deleteMany();
  await db.donorVehicle.deleteMany();
  await db.partNumber.deleteMany();
  await db.part.deleteMany();
  await db.category.deleteMany();
  await db.group.deleteMany();
  await db.vehicleGeneration.deleteMany();
  await db.vehicleModelGroup.deleteMany();
  await db.vehicleMake.deleteMany();
  await db.buyer.deleteMany();
  await db.seller.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.user.deleteMany();
}

async function seedTaxonomy(db: PrismaClient) {
  const groups = await db.group.createManyAndReturn({
    data: GROUPS.map((g, i) => ({ slug: g.slug, name: g.name, displayOrder: i + 1 })),
  });
  const groupBySlug = new Map(groups.map((g) => [g.slug, g.id]));

  await db.category.createMany({
    data: CATEGORIES.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      groupId: groupBySlug.get(c.groupSlug)!,
      synonyms: c.synonyms ?? [],
      displayOrder: i + 1,
    })),
  });
  const categories = await db.category.findMany();
  return new Map(categories.map((c) => [c.slug, c.id]));
}

async function seedVehicles(db: PrismaClient) {
  const makes = await db.vehicleMake.createManyAndReturn({
    data: MAKES.map((m, i) => ({
      slug: m.slug,
      name: m.name,
      country: m.country ?? null,
      displayOrder: i + 1,
    })),
  });
  const makeBySlug = new Map(makes.map((m) => [m.slug, m.id]));

  const modelGroups = await db.vehicleModelGroup.createManyAndReturn({
    data: MODEL_GROUPS.map((mg, i) => ({
      slug: mg.slug,
      name: mg.name,
      makeId: makeBySlug.get(mg.makeSlug)!,
      displayOrder: i + 1,
    })),
  });
  const mgBySlug = new Map(modelGroups.map((mg) => [mg.slug, mg.id]));

  const generations = await db.vehicleGeneration.createManyAndReturn({
    data: GENERATIONS.map((g, i) => ({
      slug: g.slug,
      label: g.label,
      chassisCodes: g.chassisCodes,
      productionStart: g.productionStart,
      productionEnd: g.productionEnd,
      modelGroupId: mgBySlug.get(g.modelGroupSlug)!,
      displayOrder: i + 1,
    })),
  });
  return new Map(generations.map((g) => [g.slug, g.id]));
}

const pad = (prefix: string, n: number) =>
  `${prefix}-${String(n).padStart(6, "0")}`;

const PLACEHOLDER_PHOTO = (label: string) =>
  `https://placehold.co/800x600?text=${encodeURIComponent(label)}`;

export async function seedDatabase(db: PrismaClient): Promise<SeedCounts> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database.");
  }

  await wipe(db);

  const categoryBySlug = await seedTaxonomy(db);
  const generationBySlug = await seedVehicles(db);

  let partCounter = 0;
  let listingCounter = 0;
  let orderCounter = 0;

  const createLogin = async (email: string, name: string, role: Role) => {
    const user = await db.user.create({
      data: { email, name, role, emailVerified: true },
    });
    await db.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(DEMO_PASSWORD),
      },
    });
    return user;
  };

  // --- People --------------------------------------------------------------
  // Staff: one login per founder (attributable).
  await createLogin("lucy@ivo.example", "Lucy (staff)", "staff");
  await createLogin("ivo@ivo.example", "Ivo (staff)", "staff");

  const buyerUsers = await Promise.all([
    createLogin("maria.buyer@example.com", "Maria Ivanova", "buyer"),
    createLogin("georgi.buyer@example.com", "Georgi Petrov", "buyer"),
    createLogin("elena.buyer@example.com", "Elena Dimitrova", "buyer"),
  ]);
  const buyers = await Promise.all(
    buyerUsers.map((u, i) =>
      db.buyer.create({
        data: {
          userId: u.id,
          recipientName: u.name,
          phone: `+35988${100000 + i}`,
          addressLine1: `${10 + i} Vitosha Blvd`,
          city: ["Sofia", "Plovdiv", "Varna"][i],
          postcode: ["1000", "4000", "9000"][i],
          country: "BG",
        },
      }),
    ),
  );

  // Sellers: 4 profiles, staff-created. Index 0 has a provisioned login and is the
  // demo target that must exercise every seller-center surface.
  const loginSellerUser = await createLogin(
    "yard.sofia@example.com",
    "Sofia Auto Dismantlers",
    "seller",
  );
  const sellerDefs = [
    { displayName: "Sofia Auto Dismantlers", city: "Sofia", userId: loginSellerUser.id as string | null },
    { displayName: "Plovdiv Parts EOOD", city: "Plovdiv", userId: null },
    { displayName: "Burgas Car Recycling", city: "Burgas", userId: null },
    { displayName: "Ivan's Garage Surplus", city: "Ruse", userId: null },
  ];
  const sellers = await Promise.all(
    sellerDefs.map((s, i) =>
      db.seller.create({
        data: {
          userId: s.userId,
          displayName: s.displayName,
          contactName: ["Todor", "Nikolay", "Dimitar", "Ivan"][i],
          contactEmail: `contact${i}@example.com`,
          contactPhone: `+35987${200000 + i}`,
          locationName: s.displayName,
          locationLine1: `${5 + i} Industrial Zone`,
          locationCity: s.city,
          locationPostcode: ["1510", "4003", "8000", "7000"][i],
          locationCountry: "BG",
        },
      }),
    ),
  );
  const loginSeller = sellers[0];

  // --- Donor vehicles ----------------------------------------------------
  const genSlugs = [...generationBySlug.keys()];
  const donorSpecs = [
    { seller: 0, gen: "vw-golf-mk6-5k", label: "Silver Golf Mk6 1.6 TDI, Sofia yard", engine: "1.6 TDI", engineCode: "CAYC", fuel: "Diesel", transmission: "manual" as const, bodyStyle: "Hatchback", drivetrain: "FWD", year: 2011, km: 214000 },
    { seller: 0, gen: "audi-a4-b8-8k", label: "Black A4 B8 2.0 TDI Avant", engine: "2.0 TDI", engineCode: "CAGA", fuel: "Diesel", transmission: "automatic" as const, bodyStyle: "Estate", drivetrain: "FWD", year: 2012, km: 268000 },
    { seller: 0, gen: "bmw-3-e90", label: "Blue 320d E91 Touring", engine: "2.0d", engineCode: "N47D20", fuel: "Diesel", transmission: "automatic" as const, bodyStyle: "Estate", drivetrain: "RWD", year: 2010, km: 240000 },
    { seller: 0, gen: "vw-passat-b7-36", label: "Grey Passat B7 2.0 TDI saloon", engine: "2.0 TDI", engineCode: "CFFB", fuel: "Diesel", transmission: "manual" as const, bodyStyle: "Saloon", drivetrain: "FWD", year: 2013, km: 190000 },
    { seller: 0, gen: "opel-astra-j", label: "White Astra J 1.7 CDTI", engine: "1.7 CDTI", engineCode: "A17DTR", fuel: "Diesel", transmission: "manual" as const, bodyStyle: "Hatchback", drivetrain: "FWD", year: 2012, km: 205000 },
    { seller: 1, gen: "mb-c-w204", label: "C220 CDI W204", engine: "2.2 CDI", engineCode: "OM651", fuel: "Diesel", transmission: "automatic" as const, bodyStyle: "Saloon", drivetrain: "RWD", year: 2011, km: 230000 },
    { seller: 2, gen: "ford-focus-mk3", label: "Red Focus Mk3 1.6 TDCi", engine: "1.6 TDCi", engineCode: "T1DB", fuel: "Diesel", transmission: "manual" as const, bodyStyle: "Hatchback", drivetrain: "FWD", year: 2013, km: 176000 },
    { seller: 3, gen: "toyota-corolla-e15", label: "Corolla E150 1.4 D-4D", engine: "1.4 D-4D", engineCode: "1ND-TV", fuel: "Diesel", transmission: "manual" as const, bodyStyle: "Saloon", drivetrain: "FWD", year: 2009, km: 260000 },
  ];
  const donors = await Promise.all(
    donorSpecs.map((d) =>
      db.donorVehicle.create({
        data: {
          sellerId: sellers[d.seller].id,
          generationId: generationBySlug.get(d.gen) ?? generationBySlug.get(genSlugs[0])!,
          label: d.label,
          donorYear: d.year,
          mileageKm: d.km,
          vin: "WVWZZZ00ZZ000000" + d.year,
          registrationCountry: "BG",
          engine: d.engine,
          engineCode: d.engineCode,
          fuel: d.fuel,
          transmission: d.transmission,
          bodyStyle: d.bodyStyle,
          drivetrain: d.drivetrain,
        },
      }),
    ),
  );

  // --- Parts + listings ------------------------------------------------
  const listingPlan: Array<{
    donor: number;
    category: string;
    partName: string;
    pn?: string;
    price: string;
    condition: "new" | "used_good" | "needs_repair";
    status: "draft" | "published" | "reserved" | "sold" | "cancelled" | "archived";
    defects?: string[];
  }> = [
    { donor: 0, category: "alternator", partName: "Alternator 140A", pn: "03L903023F", price: "120.00", condition: "used_good", status: "published" },
    { donor: 0, category: "headlight", partName: "Headlight, left, halogen", pn: "5K1941005", price: "85.00", condition: "used_good", status: "published", defects: ["Small crack in mounting tab, does not affect fitment"] },
    { donor: 0, category: "turbocharger", partName: "Turbocharger CAYC", pn: "03L253056A", price: "310.00", condition: "used_good", status: "reserved" },
    { donor: 0, category: "front-door", partName: "Front door, right", price: "160.00", condition: "used_good", status: "published" },
    { donor: 0, category: "instrument-cluster", partName: "Instrument cluster (diesel, MT)", pn: "5K0920875", price: "95.00", condition: "used_good", status: "sold" },
    { donor: 0, category: "manual-gearbox", partName: "5-speed manual gearbox LHY", pn: "0A4300041", price: "420.00", condition: "used_good", status: "published" },
    { donor: 0, category: "ac-compressor", partName: "A/C compressor Sanden", pn: "1K0820859S", price: "140.00", condition: "needs_repair", status: "draft", defects: ["Clutch slips when hot", "Needs regas after fitting"] },
    { donor: 1, category: "engine-control-unit", partName: "Engine ECU 2.0 TDI CAGA", pn: "03L906023", price: "180.00", condition: "used_good", status: "published" },
    { donor: 1, category: "tail-light", partName: "Tail light, left, Avant, outer", pn: "8K9945095", price: "70.00", condition: "used_good", status: "published" },
    { donor: 1, category: "wing-mirror", partName: "Wing mirror, right, power fold", price: "110.00", condition: "used_good", status: "archived" },
    { donor: 1, category: "front-bumper", partName: "Front bumper, S-line, primed", price: "220.00", condition: "needs_repair", status: "published", defects: ["Two mounting brackets broken", "Paint scuffed on lower lip"] },
    { donor: 2, category: "starter-motor", partName: "Starter motor N47", pn: "8570846", price: "95.00", condition: "used_good", status: "cancelled" },
    { donor: 2, category: "shock-absorber-strut", partName: "Rear shock absorber, right", price: "45.00", condition: "used_good", status: "published" },
    { donor: 2, category: "steering-rack", partName: "Steering rack, electric", pn: "32106783106", price: "260.00", condition: "used_good", status: "published" },
    { donor: 3, category: "radiator", partName: "Coolant radiator, manual", pn: "3C0121253Q", price: "60.00", condition: "used_good", status: "published" },
    { donor: 4, category: "egr-valve-cooler", partName: "EGR cooler A17DTR", pn: "55565963", price: "85.00", condition: "used_good", status: "published" },
    { donor: 5, category: "diesel-injection-pump", partName: "High-pressure fuel pump OM651", pn: "0445010512", price: "230.00", condition: "used_good", status: "published" },
    { donor: 6, category: "clutch-and-flywheel", partName: "Dual-mass flywheel + clutch kit", price: "175.00", condition: "used_good", status: "published" },
    { donor: 7, category: "water-pump", partName: "Water pump 1ND-TV", pn: "1610009520", price: "40.00", condition: "used_good", status: "published" },
  ];

  const listings = [];
  for (const p of listingPlan) {
    partCounter += 1;
    listingCounter += 1;
    const donor = donors[p.donor];
    const part = await db.part.create({
      data: {
        internalCode: pad("PRT", partCounter),
        categoryId: categoryBySlug.get(p.category)!,
        name: p.partName,
        partStatus: "provisional",
        pnStatus: p.pn ? "unverified" : "unknown",
        partNumbers: p.pn
          ? {
              create: {
                raw: p.pn,
                normalized: p.pn.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                numberType: "oem",
                isPrimary: true,
              },
            }
          : undefined,
      },
    });
    const listing = await db.listing.create({
      data: {
        internalCode: pad("LST", listingCounter),
        partId: part.id,
        sellerId: donor.sellerId,
        donorVehicleId: donor.id,
        priceEur: p.price,
        condition: p.condition,
        status: p.status,
        publishedAt:
          p.status === "draft" ? null : new Date(Date.now() - listingCounter * 8.64e7),
        photos: {
          create: [
            { url: PLACEHOLDER_PHOTO(p.partName), displayOrder: 0 },
            { url: PLACEHOLDER_PHOTO(p.partName + " 2"), displayOrder: 1 },
          ],
        },
        defects: p.defects
          ? { create: p.defects.map((d, i) => ({ description: d, displayOrder: i })) }
          : undefined,
      },
    });
    listings.push(listing);
  }

  // --- Favourites (buyer 0), including one now-unavailable listing ---------
  const favTargets = listings.filter((l) =>
    ["published", "reserved", "sold"].includes(l.status),
  );
  await db.favorite.createMany({
    data: favTargets.slice(0, 5).map((l) => ({ buyerId: buyers[0].id, listingId: l.id })),
  });

  // --- Orders across the lifecycle, all on the login seller -------------
  const sellerListings = listings.filter((l) => l.sellerId === loginSeller.id);
  const orderPlan: Array<{
    listing: string;
    status: "placed" | "confirmed" | "shipped" | "delivered" | "cancelled";
    buyer: number;
  }> = [
    { listing: sellerListings.find((l) => l.status === "reserved")!.internalCode, status: "confirmed", buyer: 0 },
    { listing: sellerListings.find((l) => l.status === "sold")!.internalCode, status: "delivered", buyer: 1 },
  ];
  const spare = sellerListings.filter((l) => l.status === "published").slice(0, 3);
  orderPlan.push({ listing: spare[0].internalCode, status: "placed", buyer: 2 });
  orderPlan.push({ listing: spare[1].internalCode, status: "shipped", buyer: 0 });
  orderPlan.push({ listing: spare[2].internalCode, status: "cancelled", buyer: 1 });

  const listingByCode = new Map(listings.map((l) => [l.internalCode, l]));
  for (const o of orderPlan) {
    orderCounter += 1;
    const listing = listingByCode.get(o.listing)!;
    const buyer = buyers[o.buyer];
    const now = Date.now();
    const order = await db.order.create({
      data: {
        internalCode: pad("ORD", orderCounter),
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        listingId: listing.id,
        itemPriceEur: listing.priceEur,
        status: o.status,
        lastReachedStatus: o.status === "cancelled" ? "confirmed" : null,
        confirmedAt:
          ["confirmed", "shipped", "delivered", "cancelled"].includes(o.status)
            ? new Date(now - 6 * 8.64e7)
            : null,
        shippedAt: ["shipped", "delivered"].includes(o.status)
          ? new Date(now - 3 * 8.64e7)
          : null,
        deliveredAt: o.status === "delivered" ? new Date(now - 8.64e7) : null,
        cancelledAt: o.status === "cancelled" ? new Date(now - 2 * 8.64e7) : null,
        expectedTimeRange: ["shipped", "delivered"].includes(o.status)
          ? "3–5 working days"
          : null,
        trackingNumber: ["shipped", "delivered"].includes(o.status)
          ? "BG" + (1000000 + orderCounter)
          : null,
        shippingCostEur: ["confirmed", "shipped", "delivered"].includes(o.status)
          ? "12.00"
          : null,
        recipientName: buyer.recipientName!,
        phone: buyer.phone!,
        addressLine1: buyer.addressLine1!,
        city: buyer.city!,
        postcode: buyer.postcode!,
        country: buyer.country!,
      },
    });

    if (o.status === "confirmed") {
      await db.cancellationRequest.create({
        data: {
          orderId: order.id,
          requestedBy: "buyer",
          reason: "found_elsewhere",
          state: "pending",
          autoApproveAt: new Date(now + 5 * 8.64e7),
        },
      });
    }

    const buyerNotif: Array<
      "order_placed" | "order_confirmed" | "order_shipped" | "order_delivered"
    > = [];
    if (["placed", "confirmed", "shipped", "delivered"].includes(o.status))
      buyerNotif.push("order_placed");
    if (["confirmed", "shipped", "delivered"].includes(o.status))
      buyerNotif.push("order_confirmed");
    if (["shipped", "delivered"].includes(o.status)) buyerNotif.push("order_shipped");
    if (o.status === "delivered") buyerNotif.push("order_delivered");
    await db.notification.createMany({
      data: buyerNotif.map((type, i) => ({
        userId: buyer.userId!,
        type,
        subjectType: "order" as const,
        subjectId: order.id,
        readAt: i < buyerNotif.length - 1 ? new Date(now - 8.64e7) : null,
      })),
    });
    await db.notification.create({
      data: {
        userId: loginSellerUser.id,
        type: "order_placed",
        subjectType: "order",
        subjectId: order.id,
        readAt: null,
      },
    });
  }

  // --- Threads with unread messages on the login seller's listings --------
  const threadTargets = sellerListings
    .filter((l) => ["published", "reserved"].includes(l.status))
    .slice(0, 3);
  for (let i = 0; i < threadTargets.length; i++) {
    const listing = threadTargets[i];
    const buyer = buyers[i % buyers.length];
    const thread = await db.thread.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        lastMessageAt: new Date(Date.now() - i * 3.6e6),
      },
    });
    await db.message.create({
      data: {
        threadId: thread.id,
        senderRole: "buyer",
        senderUserId: buyer.userId!,
        body: "Hi, is this still available and would you post to Varna?",
        readAt: i === 0 ? new Date() : null,
      },
    });
    if (i === 0) {
      await db.message.create({
        data: {
          threadId: thread.id,
          senderRole: "seller",
          senderUserId: loginSellerUser.id,
          body: "Yes, still available. Postage to Varna is about 12 EUR.",
          readAt: null,
        },
      });
    }
  }

  return {
    groups: await db.group.count(),
    categories: await db.category.count(),
    makes: await db.vehicleMake.count(),
    modelGroups: await db.vehicleModelGroup.count(),
    generations: await db.vehicleGeneration.count(),
    users: await db.user.count(),
    sellers: await db.seller.count(),
    buyers: await db.buyer.count(),
    donorVehicles: await db.donorVehicle.count(),
    listings: await db.listing.count(),
    orders: await db.order.count(),
    cancellationRequests: await db.cancellationRequest.count(),
    favorites: await db.favorite.count(),
    threads: await db.thread.count(),
    messages: await db.message.count(),
    notifications: await db.notification.count(),
  };
}
