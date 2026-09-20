import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { reserveListing, confirmOrder, cancelOrder } from "./orders";
import { runCancellationSweep } from "./cancellation-sweep";

/**
 * The daily Vercel Cron job (docs/order-model.md section 6.5). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; anything else must be refused and must change nothing.
 */
const TAG = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;
const DAY = 24 * 60 * 60 * 1000;
const SECRET = "cron-secret-for-tests-0123456789";
const start = new Date("2001-01-01T10:00:00Z");
const later = new Date(start.getTime() + 8 * DAY);

let sellerId: string;
let orderId: string;
const userIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];
const donorIds: string[] = [];
let buyerId: string;
let generationId: string;
let categoryId: string;

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 961 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;

  const sellerUser = await db.user.create({ data: { name: S("s"), email: `s-${TAG}@example.test`, role: "seller" } });
  const buyerUser = await db.user.create({ data: { name: S("b"), email: `b-${TAG}@example.test`, role: "buyer" } });
  userIds.push(sellerUser.id, buyerUser.id);
  sellerId = (await db.seller.create({ data: { displayName: S("Seller"), contactName: "C", contactEmail: `s-${TAG}@x.test`, locationCity: "Sofia", userId: sellerUser.id } })).id;
  buyerId = (await db.buyer.create({ data: { userId: buyerUser.id } })).id;

  const donor = await db.donorVehicle.create({ data: { sellerId, generationId, label: S("car") } });
  donorIds.push(donor.id);
  const part = await db.part.create({ data: { internalCode: S("PRT"), categoryId, name: S("part") } });
  partIds.push(part.id);
  const listing = await db.listing.create({
    data: { internalCode: S("LST"), partId: part.id, donorVehicleId: donor.id, sellerId, priceEur: "10.00", condition: "used_good", status: "published", publishedAt: start, noVisiblePartNumber: true },
  });
  listingIds.push(listing.id);

  const buyer = { userId: buyerUser.id, role: "buyer" as const, buyerId, sellerId: null, messagingBlocked: false };
  const seller = { userId: sellerUser.id, role: "seller" as const, buyerId: null, sellerId, messagingBlocked: false };
  const placed = await reserveListing(
    db,
    buyer,
    { listingCode: listing.internalCode, address: { recipientName: "I", phone: "1", addressLine1: "a", city: "c", postcode: "p" } },
    start,
  );
  orderId = placed.orderId;
  await confirmOrder(db, seller, orderId, start);
  await cancelOrder(db, buyer, orderId, { reason: "seller_too_slow" }, start);
});

afterAll(async () => {
  await db.order.deleteMany({ where: { sellerId } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: sellerId } });
  await db.buyer.deleteMany({ where: { id: buyerId } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

const statusOf = async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status;

describe("the cancellation sweep endpoint", () => {
  it("refuses a request without the secret, a wrong one, or when no secret is configured, and changes nothing", async () => {
    for (const [authorization, secret] of [
      [null, SECRET],
      ["Bearer wrong", SECRET],
      [SECRET, SECRET], // missing the "Bearer " part
      [`Bearer ${SECRET}`, undefined], // no secret configured: fail closed
      ["Bearer ", ""],
    ] as const) {
      expect(await runCancellationSweep(db, { authorization, secret }, later)).toEqual({ status: 401 });
    }
    expect(await statusOf()).toBe("confirmed");
  });

  it("with the right secret, approves the overdue request and reports it", async () => {
    const result = await runCancellationSweep(db, { authorization: `Bearer ${SECRET}`, secret: SECRET }, later);

    expect(result.status).toBe(200);
    expect(await statusOf()).toBe("cancelled");
    const request = await db.cancellationRequest.findUniqueOrThrow({ where: { orderId } });
    expect(request).toMatchObject({ state: "approved", resolvedBy: "auto" });
  });
});
