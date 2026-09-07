import type { PrismaClient, Condition, Transmission, Prisma } from "@prisma/client";

/**
 * The buyer provenance match + faceted Browse results
 * (docs/buyer-funnel-search.md §3–§4). Node-safe.
 *
 * Match: `Listing.status ∈ {published,reserved}` ∧ `part.categoryId == C`
 * ∧ the donor vehicle's generation is X (full funnel) or any generation of the
 * Model Group (partial funnel). There is NO Fitment path and NO union — a Part
 * is found only through the donor vehicle of its Listings.
 *
 * v1 loads the candidate set (car + category scope) and does faceting / sorting
 * / pagination in memory — the demo catalogue is small and this keeps faceted
 * counts trivially correct. Move to SQL when volume warrants.
 */

export const PAGE_SIZE = 12;

export type BrowseSort = "newest" | "price_asc" | "price_desc" | "condition";

export interface BrowseParams {
  categoryId?: string;
  /** Partial funnel — any generation of this model group. Also scopes the Generation facet. */
  modelGroupId?: string;
  /** Full funnel car, or the active Generation-facet pick in a partial funnel. */
  generationId?: string;
  engine?: string;
  fuel?: string;
  transmission?: Transmission;
  condition?: Condition;
  minPriceEur?: number;
  maxPriceEur?: number;
  sort?: BrowseSort;
  page?: number;
}

export interface BrowseRow {
  id: string;
  internalCode: string;
  title: string;
  priceEur: string;
  negotiable: boolean;
  condition: Condition;
  publishedAt: Date | null;
  photoUrl: string | null;
  photoCount: number;
  partNumber: string | null;
  defects: string[];
  donor: {
    makeName: string;
    modelGroupName: string;
    generationLabel: string;
    engine: string | null;
    engineCode: string | null;
    fuel: string | null;
    transmission: Transmission | null;
  };
  seller: { name: string; city: string; country: string };
}

export interface FacetCount<V = string> { value: V; label: string; count: number }

export interface BrowseResult {
  rows: BrowseRow[];
  total: number;
  page: number;
  pageCount: number;
  facets: {
    categories: FacetCount[];
    generations: FacetCount[];
    engines: FacetCount[];
    fuels: FacetCount[];
    transmissions: FacetCount[];
    conditions: FacetCount[];
    priceRange: { min: number; max: number } | null;
  };
}

type Candidate = Prisma.ListingGetPayload<{
  select: ReturnType<typeof candidateSelect>;
}>;

function candidateSelect() {
  return {
    id: true,
    internalCode: true,
    priceEur: true,
    negotiable: true,
    condition: true,
    publishedAt: true,
    part: {
      select: {
        name: true,
        categoryId: true,
        category: { select: { slug: true, name: true } },
        partNumbers: {
          orderBy: { isPrimary: "desc" as const },
          take: 1,
          select: { raw: true },
        },
      },
    },
    donorVehicle: {
      select: {
        engine: true,
        engineCode: true,
        fuel: true,
        transmission: true,
        generation: {
          select: {
            id: true,
            slug: true,
            label: true,
            modelGroup: {
              select: { name: true, make: { select: { name: true } } },
            },
          },
        },
      },
    },
    seller: {
      select: { displayName: true, locationCity: true, locationCountry: true },
    },
    photos: { orderBy: { displayOrder: "asc" as const }, take: 1, select: { url: true } },
    defects: { orderBy: { displayOrder: "asc" as const }, select: { description: true } },
    _count: { select: { photos: true } },
  };
}

const CONDITION_LABEL: Record<Condition, string> = {
  new: "New",
  used_good: "Used — good",
  needs_repair: "Needs repair",
};
const TRANSMISSION_LABEL: Record<Transmission, string> = {
  manual: "Manual",
  automatic: "Automatic",
  other: "Other",
};

export async function browseListings(
  db: PrismaClient,
  params: BrowseParams,
): Promise<BrowseResult> {
  const carScope: Prisma.ListingWhereInput = params.modelGroupId
    ? { donorVehicle: { generation: { modelGroupId: params.modelGroupId } } }
    : params.generationId
      ? { donorVehicle: { generationId: params.generationId } }
      : {};

  const candidates = await db.listing.findMany({
    where: {
      status: { in: ["published", "reserved"] },
      ...(params.categoryId ? { part: { categoryId: params.categoryId } } : {}),
      ...carScope,
    },
    select: candidateSelect(),
  });

  // Active facet predicates, keyed so we can drop one for its own count.
  const preds: Record<string, (c: Candidate) => boolean> = {
    category: (c) => !params.categoryId || c.part.categoryId === params.categoryId,
    generation: (c) => !params.generationId || c.donorVehicle.generation.id === params.generationId,
    engine: (c) => !params.engine || c.donorVehicle.engine === params.engine,
    fuel: (c) => !params.fuel || c.donorVehicle.fuel === params.fuel,
    transmission: (c) => !params.transmission || c.donorVehicle.transmission === params.transmission,
    condition: (c) => !params.condition || c.condition === params.condition,
    price: (c) => {
      const p = Number(c.priceEur);
      return (
        (params.minPriceEur == null || p >= params.minPriceEur) &&
        (params.maxPriceEur == null || p <= params.maxPriceEur)
      );
    },
  };
  const passesAll = (c: Candidate) => Object.values(preds).every((f) => f(c));
  const passesAllBut = (c: Candidate, skip: string) =>
    Object.entries(preds).every(([k, f]) => k === skip || f(c));

  const filtered = candidates.filter(passesAll);
  const total = filtered.length;
  const page = Math.max(1, params.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sorted = sortRows(filtered, params.sort ?? "newest");
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    rows: pageRows.map(toRow),
    total,
    page,
    pageCount,
    facets: {
      categories: tally(candidates, (c) => passesAllBut(c, "category"), (c) => [c.part.category.slug, c.part.category.name]),
      generations: tally(candidates, (c) => passesAllBut(c, "generation"), (c) => [c.donorVehicle.generation.slug, c.donorVehicle.generation.label]),
      engines: tally(candidates, (c) => passesAllBut(c, "engine"), (c) => (c.donorVehicle.engine ? [c.donorVehicle.engine, c.donorVehicle.engine] : null)),
      fuels: tally(candidates, (c) => passesAllBut(c, "fuel"), (c) => (c.donorVehicle.fuel ? [c.donorVehicle.fuel, c.donorVehicle.fuel] : null)),
      transmissions: tally(candidates, (c) => passesAllBut(c, "transmission"), (c) => (c.donorVehicle.transmission ? [c.donorVehicle.transmission, TRANSMISSION_LABEL[c.donorVehicle.transmission]] : null)),
      conditions: tally(candidates, (c) => passesAllBut(c, "condition"), (c) => [c.condition, CONDITION_LABEL[c.condition]]),
      priceRange: priceRange(candidates.filter((c) => passesAllBut(c, "price"))),
    },
  };
}

function sortRows(rows: Candidate[], sort: BrowseSort): Candidate[] {
  const conditionRank: Record<Condition, number> = { new: 0, used_good: 1, needs_repair: 2 };
  const copy = [...rows];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => Number(a.priceEur) - Number(b.priceEur));
    case "price_desc":
      return copy.sort((a, b) => Number(b.priceEur) - Number(a.priceEur));
    case "condition":
      return copy.sort((a, b) => conditionRank[a.condition] - conditionRank[b.condition]);
    case "newest":
    default:
      return copy.sort(
        (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      );
  }
}

function toRow(c: Candidate): BrowseRow {
  const mg = c.donorVehicle.generation.modelGroup;
  return {
    id: c.id,
    internalCode: c.internalCode,
    title: c.part.name,
    priceEur: String(c.priceEur),
    negotiable: c.negotiable,
    condition: c.condition,
    publishedAt: c.publishedAt,
    photoUrl: c.photos[0]?.url ?? null,
    photoCount: c._count.photos,
    partNumber: c.part.partNumbers[0]?.raw ?? null,
    defects: c.defects.map((d) => d.description),
    donor: {
      makeName: mg.make.name,
      modelGroupName: mg.name,
      generationLabel: c.donorVehicle.generation.label,
      engine: c.donorVehicle.engine,
      engineCode: c.donorVehicle.engineCode,
      fuel: c.donorVehicle.fuel,
      transmission: c.donorVehicle.transmission,
    },
    seller: {
      name: c.seller.displayName,
      city: c.seller.locationCity,
      country: c.seller.locationCountry,
    },
  };
}

function tally(
  candidates: Candidate[],
  pass: (c: Candidate) => boolean,
  pick: (c: Candidate) => [string, string] | null,
): FacetCount[] {
  const map = new Map<string, FacetCount>();
  for (const c of candidates) {
    if (!pass(c)) continue;
    const kv = pick(c);
    if (!kv) continue;
    const [value, label] = kv;
    const cur = map.get(value) ?? { value, label, count: 0 };
    cur.count += 1;
    map.set(value, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function priceRange(candidates: Candidate[]): { min: number; max: number } | null {
  if (candidates.length === 0) return null;
  const prices = candidates.map((c) => Number(c.priceEur));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
