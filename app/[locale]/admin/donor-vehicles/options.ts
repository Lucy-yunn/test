import { db } from "@/lib/db";
import type { Option } from "./donor-vehicle-form";

export async function loadSellerOptions(): Promise<Option[]> {
  const rows = await db.seller.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, locationCity: true },
  });
  return rows.map((r) => ({ id: r.id, label: `${r.displayName} — ${r.locationCity}` }));
}

export async function loadGenerationOptions(): Promise<Option[]> {
  const rows = await db.vehicleGeneration.findMany({
    orderBy: [{ modelGroup: { make: { name: "asc" } } }, { label: "asc" }],
    select: {
      id: true,
      label: true,
      modelGroup: { select: { name: true, make: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    label: `${r.modelGroup.make.name} ${r.modelGroup.name} · ${r.label}`,
  }));
}

const EMPTY = {
  sellerId: "",
  generationId: "",
  label: "",
  donorYear: "",
  vin: "",
  vinDerivedNotes: "",
  mileageKm: "",
  registrationCountry: "",
  notes: "",
  engine: "",
  engineCode: "",
  fuel: "",
  transmission: "",
  bodyStyle: "",
  drivetrain: "",
};
export const EMPTY_DONOR = EMPTY;
