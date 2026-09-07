import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  createPart,
  updatePart,
  setPartStatus,
  addPartNumber,
  updatePartNumber,
  removePartNumber,
  checkPartNumberConflict,
  searchParts,
} from "./parts";
import { nextInternalCode, parseCodeNumber } from "./internal-code";
import { InvariantError, NotFoundError } from "../dal/errors";

const TAG = `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
let categoryId: string;
const partIds: string[] = [];

beforeAll(async () => {
  const group = await db.group.create({
    data: { name: `G ${TAG}`, slug: `g-${TAG}`, displayOrder: 900 },
  });
  categoryId = (
    await db.category.create({
      data: { name: `Water pump ${TAG}`, slug: `wp-${TAG}`, groupId: group.id, displayOrder: 1 },
    })
  ).id;
});

afterAll(async () => {
  await db.partNumber.deleteMany({ where: { part: { id: { in: partIds } } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.category.deleteMany({ where: { slug: `wp-${TAG}` } });
  await db.group.deleteMany({ where: { slug: `g-${TAG}` } });
  await db.$disconnect();
});

async function mkPart(name: string, attributes?: unknown) {
  const p = await createPart(db, { categoryId, name, attributes });
  partIds.push(p.id);
  return p;
}

describe("nextInternalCode", () => {
  it("hands out sequential zero-padded PRT codes", async () => {
    const a = await mkPart(`Pump A ${TAG}`);
    const next = await nextInternalCode(db, "PRT");
    expect(parseCodeNumber(next)).toBe(parseCodeNumber(a.internalCode) + 1);
    expect(next).toMatch(/^PRT-\d{6}$/);
  });
});

describe("createPart", () => {
  it("stores validated attributes and a fresh code", async () => {
    const p = await mkPart(`Attr ${TAG}`, { note: "reman", flow: 120 });
    const row = await db.part.findUnique({ where: { id: p.id } });
    expect(row?.attributes).toEqual({ note: "reman", flow: 120 });
    expect(p.internalCode).toMatch(/^PRT-\d{6}$/);
  });

  it("rejects a non-object attributes value", async () => {
    await expect(mkPart(`Bad ${TAG}`, "nope")).rejects.toBeInstanceOf(InvariantError);
  });

  it("throws NotFoundError for an unknown category", async () => {
    await expect(createPart(db, { categoryId: "nope", name: "x" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("setPartStatus", () => {
  it("allows provisional→confirmed once and blocks the reverse", async () => {
    const p = await mkPart(`Status ${TAG}`);
    await setPartStatus(db, p.id, "confirmed");
    expect((await db.part.findUnique({ where: { id: p.id } }))?.partStatus).toBe("confirmed");
    await expect(setPartStatus(db, p.id, "provisional")).rejects.toBeInstanceOf(InvariantError);
  });
});

describe("part numbers + pnStatus + de-dup", () => {
  it("recomputes pnStatus, keeps ≤1 primary, and surfaces a cross-part conflict", async () => {
    const a = await mkPart(`PN A ${TAG}`);
    const b = await mkPart(`PN B ${TAG}`);

    const r1 = await addPartNumber(db, { partId: a.id, raw: "0K0 121 011 A", isPrimary: true });
    expect(r1.conflict).toBeNull();
    expect((await db.part.findUnique({ where: { id: a.id } }))?.pnStatus).toBe("unverified");

    await addPartNumber(db, { partId: a.id, raw: "9999 alt", isPrimary: true });
    expect(await db.partNumber.count({ where: { partId: a.id, isPrimary: true } })).toBe(1);

    const r2 = await addPartNumber(db, { partId: b.id, raw: "0k0-121-011-a" });
    expect(r2.conflict?.partId).toBe(a.id);

    const first = await db.partNumber.findFirstOrThrow({ where: { partId: a.id } });
    await updatePartNumber(db, first.id, { verified: true });
    expect((await db.part.findUnique({ where: { id: a.id } }))?.pnStatus).toBe("verified");
    await removePartNumber(db, first.id);
    expect((await db.part.findUnique({ where: { id: a.id } }))?.pnStatus).toBe("unverified");
  });

  it("rejects a part number with no usable characters", async () => {
    const p = await mkPart(`Empty PN ${TAG}`);
    await expect(addPartNumber(db, { partId: p.id, raw: " / - " })).rejects.toBeInstanceOf(
      InvariantError,
    );
  });

  it("checkPartNumberConflict finds a match for the new-part flow", async () => {
    const hit = await checkPartNumberConflict(db, "0K0121011A");
    expect(hit?.internalCode).toMatch(/^PRT-/);
    expect(await checkPartNumberConflict(db, "NOTHINGLIKETHIS")).toBeNull();
  });
});

describe("searchParts / updatePart", () => {
  it("matches on name and on normalized part number", async () => {
    const p = await mkPart(`Searchable widget ${TAG}`);
    await addPartNumber(db, { partId: p.id, raw: `SRCH${TAG}` });

    expect((await searchParts(db, "Searchable widget")).some((x) => x.id === p.id)).toBe(true);
    expect((await searchParts(db, `srch${TAG}`)).some((x) => x.id === p.id)).toBe(true);
  });

  it("updatePart trims the name and revalidates attributes", async () => {
    const p = await mkPart(`Upd ${TAG}`);
    await updatePart(db, p.id, { name: "  renamed  " });
    expect((await db.part.findUnique({ where: { id: p.id } }))?.name).toBe("renamed");
    await expect(updatePart(db, p.id, { attributes: "not-an-object" })).rejects.toBeInstanceOf(
      InvariantError,
    );
  });
});
