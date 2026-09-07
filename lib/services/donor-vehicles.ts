import type { PrismaClient, Transmission } from "@prisma/client";
import { NotFoundError } from "../dal/errors";

/**
 * DonorVehicle intake (docs/spec/admin-tool.md §6.1). Node-safe. The physical car
 * a seller dismantled — entered once, many listings hang off it. `generationId`
 * is REQUIRED (no unknown-donor case). No lifecycle status — it's a data record.
 */

export interface DonorVehicleInput {
  sellerId: string;
  generationId: string;
  label: string;
  donorYear?: number | null;
  vin?: string | null;
  vinDerivedNotes?: string | null;
  mileageKm?: number | null;
  registrationCountry?: string | null;
  notes?: string | null;
  engine?: string | null;
  engineCode?: string | null;
  fuel?: string | null;
  transmission?: Transmission | null;
  bodyStyle?: string | null;
  drivetrain?: string | null;
}

const clean = (s?: string | null) => s?.trim() || null;

export async function createDonorVehicle(
  db: PrismaClient,
  input: DonorVehicleInput,
  createdBy?: string | null,
): Promise<{ id: string }> {
  await mustExist(db.seller.findUnique({ where: { id: input.sellerId } }), "Seller");
  await mustExist(
    db.vehicleGeneration.findUnique({ where: { id: input.generationId } }),
    "Vehicle generation",
  );

  return db.donorVehicle.create({
    data: {
      sellerId: input.sellerId,
      generationId: input.generationId,
      label: input.label.trim(),
      donorYear: input.donorYear ?? null,
      vin: clean(input.vin),
      vinDerivedNotes: clean(input.vinDerivedNotes),
      mileageKm: input.mileageKm ?? null,
      registrationCountry: clean(input.registrationCountry),
      notes: clean(input.notes),
      engine: clean(input.engine),
      engineCode: clean(input.engineCode),
      fuel: clean(input.fuel),
      transmission: input.transmission ?? null,
      bodyStyle: clean(input.bodyStyle),
      drivetrain: clean(input.drivetrain),
      createdBy: createdBy ?? null,
    },
    select: { id: true },
  });
}

export async function updateDonorVehicle(
  db: PrismaClient,
  id: string,
  patch: Partial<DonorVehicleInput>,
): Promise<void> {
  const existing = await db.donorVehicle.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Donor vehicle not found");

  if (patch.generationId) {
    await mustExist(
      db.vehicleGeneration.findUnique({ where: { id: patch.generationId } }),
      "Vehicle generation",
    );
  }

  const data: Record<string, unknown> = {};
  if (patch.generationId !== undefined) data.generationId = patch.generationId;
  if (patch.label !== undefined) data.label = patch.label.trim();
  if (patch.donorYear !== undefined) data.donorYear = patch.donorYear ?? null;
  if (patch.vin !== undefined) data.vin = clean(patch.vin);
  if (patch.vinDerivedNotes !== undefined) data.vinDerivedNotes = clean(patch.vinDerivedNotes);
  if (patch.mileageKm !== undefined) data.mileageKm = patch.mileageKm ?? null;
  if (patch.registrationCountry !== undefined) data.registrationCountry = clean(patch.registrationCountry);
  if (patch.notes !== undefined) data.notes = clean(patch.notes);
  if (patch.engine !== undefined) data.engine = clean(patch.engine);
  if (patch.engineCode !== undefined) data.engineCode = clean(patch.engineCode);
  if (patch.fuel !== undefined) data.fuel = clean(patch.fuel);
  if (patch.transmission !== undefined) data.transmission = patch.transmission ?? null;
  if (patch.bodyStyle !== undefined) data.bodyStyle = clean(patch.bodyStyle);
  if (patch.drivetrain !== undefined) data.drivetrain = clean(patch.drivetrain);

  await db.donorVehicle.update({ where: { id }, data });
}

async function mustExist<T>(p: Promise<T | null>, label: string): Promise<T> {
  const row = await p;
  if (!row) throw new NotFoundError(`${label} not found`);
  return row;
}
