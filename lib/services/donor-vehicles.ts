import type { PrismaClient, Transmission } from "@prisma/client";
import { blankToNull } from "../text";
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
  /** Why the car was scrapped, in the seller's own words (free text). */
  scrapReason?: string | null;
  engine?: string | null;
  engineCode?: string | null;
  fuel?: string | null;
  transmission?: Transmission | null;
  bodyStyle?: string | null;
  drivetrain?: string | null;
}


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
      vin: blankToNull(input.vin),
      vinDerivedNotes: blankToNull(input.vinDerivedNotes),
      mileageKm: input.mileageKm ?? null,
      registrationCountry: blankToNull(input.registrationCountry),
      notes: blankToNull(input.notes),
      scrapReason: blankToNull(input.scrapReason),
      engine: blankToNull(input.engine),
      engineCode: blankToNull(input.engineCode),
      fuel: blankToNull(input.fuel),
      transmission: input.transmission ?? null,
      bodyStyle: blankToNull(input.bodyStyle),
      drivetrain: blankToNull(input.drivetrain),
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
  if (patch.vin !== undefined) data.vin = blankToNull(patch.vin);
  if (patch.vinDerivedNotes !== undefined) data.vinDerivedNotes = blankToNull(patch.vinDerivedNotes);
  if (patch.mileageKm !== undefined) data.mileageKm = patch.mileageKm ?? null;
  if (patch.registrationCountry !== undefined) data.registrationCountry = blankToNull(patch.registrationCountry);
  if (patch.notes !== undefined) data.notes = blankToNull(patch.notes);
  if (patch.scrapReason !== undefined) data.scrapReason = blankToNull(patch.scrapReason);
  if (patch.engine !== undefined) data.engine = blankToNull(patch.engine);
  if (patch.engineCode !== undefined) data.engineCode = blankToNull(patch.engineCode);
  if (patch.fuel !== undefined) data.fuel = blankToNull(patch.fuel);
  if (patch.transmission !== undefined) data.transmission = patch.transmission ?? null;
  if (patch.bodyStyle !== undefined) data.bodyStyle = blankToNull(patch.bodyStyle);
  if (patch.drivetrain !== undefined) data.drivetrain = blankToNull(patch.drivetrain);

  await db.donorVehicle.update({ where: { id }, data });
}

async function mustExist<T>(p: Promise<T | null>, label: string): Promise<T> {
  const row = await p;
  if (!row) throw new NotFoundError(`${label} not found`);
  return row;
}
