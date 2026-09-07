import { db } from "@/lib/db";
import type { CategoryOption } from "./part-forms";

/** Flat, group-labelled category options for the Part editor's <select>. */
export async function loadCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await db.category.findMany({
    where: { isActive: true },
    orderBy: [{ group: { displayOrder: "asc" } }, { displayOrder: "asc" }],
    select: { id: true, name: true, group: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, group: r.group.name }));
}
