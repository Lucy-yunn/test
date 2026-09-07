import { describe, it, expect, afterAll } from "vitest";
import { db } from "../db";
import {
  addMake,
  addModelGroup,
  addGeneration,
  setCatalogueRowActive,
  renameCatalogueRow,
} from "./vehicle-catalogue";
import { ConflictError, NotFoundError } from "../dal/errors";

const TAG = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

afterAll(async () => {
  await db.vehicleGeneration.deleteMany({ where: { slug: { contains: TAG } } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: { contains: TAG } } });
  await db.vehicleMake.deleteMany({ where: { slug: { contains: TAG } } });
  await db.$disconnect();
});

describe("vehicle catalogue CRUD", () => {
  it("adds a make → model group → generation, deriving slugs", async () => {
    const make = await addMake(db, { name: `Rover ${TAG}`, country: "UK" });
    const mg = await addModelGroup(db, { makeId: make.id, name: `75, ZT ${TAG}` });
    const gen = await addGeneration(db, {
      modelGroupId: mg.id,
      label: `75 RJ ${TAG} (1998–2005)`,
      chassisCodes: ["RJ", " "],
      productionStart: 1998,
      productionEnd: 2005,
    });

    const row = await db.vehicleGeneration.findUnique({ where: { id: gen.id } });
    expect(row?.slug).toContain(TAG.toLowerCase());
    expect(row?.chassisCodes).toEqual(["RJ"]); // blank trimmed out
    expect(row?.isActive).toBe(true);
  });

  it("rejects a duplicate slug with ConflictError", async () => {
    await addMake(db, { name: `Dup ${TAG}`, slug: `dup-${TAG}` });
    await expect(addMake(db, { name: "Other", slug: `dup-${TAG}` })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("throws NotFoundError for a missing parent", async () => {
    await expect(
      addModelGroup(db, { makeId: "nope", name: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("toggles isActive and renames without touching the slug", async () => {
    const make = await addMake(db, { name: `Toggle ${TAG}` });
    const before = await db.vehicleMake.findUnique({ where: { id: make.id } });

    await setCatalogueRowActive(db, "vehicleMake", make.id, false);
    await renameCatalogueRow(db, "vehicleMake", make.id, { name: "Toggled Name" });

    const after = await db.vehicleMake.findUnique({ where: { id: make.id } });
    expect(after?.isActive).toBe(false);
    expect(after?.name).toBe("Toggled Name");
    expect(after?.slug).toBe(before?.slug);
  });
});
