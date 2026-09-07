import type { PrismaClient } from "@prisma/client";

/**
 * Buyer-facing catalogue reads for the funnel (docs/buyer-funnel-search.md §1).
 * Node-safe. Only `isActive` rows; the Group layer is a heading, never a step.
 */

export interface MakeOption { slug: string; name: string }
export interface ModelGroupOption { slug: string; name: string }
export interface GenerationCard {
  slug: string;
  label: string;
  chassisCodes: string[];
  productionStart: number | null;
  productionEnd: number | null;
}
export interface GroupedCategories {
  group: string;
  groupSlug: string;
  categories: { slug: string; name: string }[];
}

export interface BrowseContext {
  make: { slug: string; name: string };
  modelGroup: { id: string; slug: string; name: string };
  generation: { id: string; slug: string; label: string } | null;
  category: { id: string; slug: string; name: string; groupName: string } | null;
}

/**
 * Resolve the funnel's URL segments to a validated context, or `null` if the
 * chain is broken (unknown make/model, generation not in the model group, …).
 * `/browse` calls this before `browseListings`.
 */
export async function resolveBrowseContext(
  db: PrismaClient,
  params: { make: string; model: string; generation?: string; category?: string },
): Promise<BrowseContext | null> {
  const modelGroup = await db.vehicleModelGroup.findFirst({
    where: {
      slug: params.model,
      isActive: true,
      make: { slug: params.make, isActive: true },
    },
    select: { id: true, slug: true, name: true, make: { select: { slug: true, name: true } } },
  });
  if (!modelGroup) return null;

  let generation: BrowseContext["generation"] = null;
  if (params.generation) {
    const g = await db.vehicleGeneration.findFirst({
      where: { slug: params.generation, isActive: true, modelGroupId: modelGroup.id },
      select: { id: true, slug: true, label: true },
    });
    if (!g) return null;
    generation = g;
  }

  let category: BrowseContext["category"] = null;
  if (params.category) {
    const c = await db.category.findFirst({
      where: { slug: params.category, isActive: true },
      select: { id: true, slug: true, name: true, group: { select: { name: true } } },
    });
    if (!c) return null;
    category = { id: c.id, slug: c.slug, name: c.name, groupName: c.group.name };
  }

  return {
    make: modelGroup.make,
    modelGroup: { id: modelGroup.id, slug: modelGroup.slug, name: modelGroup.name },
    generation,
    category,
  };
}

export async function getMakes(db: PrismaClient): Promise<MakeOption[]> {
  const rows = await db.vehicleMake.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true },
  });
  return rows;
}

export async function getModelGroups(
  db: PrismaClient,
  makeSlug: string,
): Promise<ModelGroupOption[]> {
  const rows = await db.vehicleModelGroup.findMany({
    where: { isActive: true, make: { slug: makeSlug, isActive: true } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true },
  });
  return rows;
}

export async function getGenerations(
  db: PrismaClient,
  modelGroupSlug: string,
): Promise<GenerationCard[]> {
  const rows = await db.vehicleGeneration.findMany({
    where: { isActive: true, modelGroup: { slug: modelGroupSlug } },
    orderBy: [{ productionStart: "asc" }, { label: "asc" }],
    select: {
      slug: true,
      label: true,
      chassisCodes: true,
      productionStart: true,
      productionEnd: true,
    },
  });
  return rows;
}

/** The Part step: one list, grouped by Group heading (#3). */
export async function getGroupedCategories(
  db: PrismaClient,
): Promise<GroupedCategories[]> {
  const groups = await db.group.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      name: true,
      slug: true,
      categories: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { slug: true, name: true },
      },
    },
  });
  return groups
    .filter((g) => g.categories.length > 0)
    .map((g) => ({ group: g.name, groupSlug: g.slug, categories: g.categories }));
}

/**
 * Homepage "What's in stock right now" — leaf categories with a live count of
 * buyer-visible listings (docs/buyer-funnel-search.md §1).
 */
export async function getInStockCategories(
  db: PrismaClient,
  limit = 24,
): Promise<{ slug: string; name: string; group: string; count: number }[]> {
  const grouped = await db.listing.groupBy({
    by: ["partId"],
    where: { status: { in: ["published", "reserved"] } },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const parts = await db.part.findMany({
    where: { id: { in: grouped.map((g) => g.partId) } },
    select: { id: true, category: { select: { slug: true, name: true, group: { select: { name: true } } } } },
  });
  const partCategory = new Map(parts.map((p) => [p.id, p.category]));

  const counts = new Map<string, { slug: string; name: string; group: string; count: number }>();
  for (const g of grouped) {
    const cat = partCategory.get(g.partId);
    if (!cat) continue;
    const cur = counts.get(cat.slug) ?? {
      slug: cat.slug,
      name: cat.name,
      group: cat.group.name,
      count: 0,
    };
    cur.count += g._count._all;
    counts.set(cat.slug, cur);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
