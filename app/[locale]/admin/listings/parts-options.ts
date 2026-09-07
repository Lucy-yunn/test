import { db } from "@/lib/db";
import type { PartOption } from "./listing-form";

/** All parts as { id, "PRT-000123 — name" } for the listing editor's <select>. */
export async function loadPartOptions(): Promise<PartOption[]> {
  const rows = await db.part.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, internalCode: true, name: true },
  });
  return rows.map((r) => ({ id: r.id, label: `${r.internalCode} — ${r.name}` }));
}
