import { describe, it, expect, afterAll, beforeEach } from "vitest";
import sharp from "sharp";
import { db } from "../db";
import { setSellerAvatar, removeSellerAvatar, type PhotoStore } from "./photos";
import { NotFoundError } from "../dal/errors";

const TAG = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** In-memory store: records what would be uploaded to and deleted from Blob. */
const uploaded = new Map<string, { data: Buffer; contentType: string }>();
let deleted: string[] = [];
const fakeStore: PhotoStore = {
  async upload(key, data, contentType) {
    uploaded.set(key, { data, contentType });
    return { url: `https://fake.blob/${key}` };
  },
  async delete(url) {
    deleted.push(url);
  },
};

const bigPng = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#357" } }).png().toBuffer();

const sellerIds: string[] = [];
async function seller() {
  const s = await db.seller.create({
    data: { displayName: `S ${TAG} ${sellerIds.length}`, contactName: "S", contactEmail: `${TAG}@x.test`, locationCity: "Sofia" },
  });
  sellerIds.push(s.id);
  return s.id;
}
const avatarOf = async (id: string) =>
  (await db.seller.findUniqueOrThrow({ where: { id }, select: { avatarUrl: true } })).avatarUrl;

beforeEach(() => {
  deleted = [];
});

afterAll(async () => {
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.$disconnect();
});

describe("seller avatar — uploaded by staff, optional", () => {
  it("downscales the image, uploads it under the seller's folder, and stores only the URL", async () => {
    const id = await seller();

    const { url } = await setSellerAvatar(db, fakeStore, { sellerId: id, image: await bigPng() });

    expect(await avatarOf(id)).toBe(url);
    const key = [...uploaded.keys()].find((k) => k.startsWith(`sellers/${id}/`));
    expect(key).toBeDefined();
    const meta = await sharp(uploaded.get(key!)!.data).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2000);
  });

  it("replaces an existing avatar and deletes the old file", async () => {
    const id = await seller();
    const first = await setSellerAvatar(db, fakeStore, { sellerId: id, image: await bigPng() });

    const second = await setSellerAvatar(db, fakeStore, { sellerId: id, image: await bigPng() });

    expect(second.url).not.toBe(first.url);
    expect(await avatarOf(id)).toBe(second.url);
    expect(deleted).toEqual([first.url]);
  });

  it("removes the avatar and its file, and removing again is harmless", async () => {
    const id = await seller();
    const { url } = await setSellerAvatar(db, fakeStore, { sellerId: id, image: await bigPng() });

    await removeSellerAvatar(db, fakeStore, id);
    await removeSellerAvatar(db, fakeStore, id);

    expect(await avatarOf(id)).toBeNull();
    expect(deleted).toEqual([url]);
  });

  it("refuses an unknown seller and uploads nothing", async () => {
    const before = uploaded.size;
    await expect(setSellerAvatar(db, fakeStore, { sellerId: "nope", image: await bigPng() })).rejects.toBeInstanceOf(NotFoundError);
    expect(uploaded.size).toBe(before);
  });
});
