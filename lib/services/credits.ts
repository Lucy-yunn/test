import type { Prisma, PrismaClient, CreditEntryKind } from "@prisma/client";
import { InvariantError, NotFoundError } from "../dal/errors";
import { notify } from "./notifications";

/**
 * Seller credits (docs/seller-credits.md, ADR-0010). Node-safe.
 *
 * Every credit change is one row in an append-only ledger, and `Seller.creditBalance`
 * caches the sum. The ledger row and the balance change are written in the same
 * transaction, and a balance is only ever lowered by a conditional update ("only if there
 * is enough"), so two requests at the same time can never spend the same credit.
 *
 * Who may call these (staff only) is decided by the Server Action, like the other services.
 */

export const NO_CREDITS_MESSAGE = "This seller has no credits.";

/** The client, or the transaction client inside `db.$transaction`. */
type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------

export interface CreditBundleRow {
  id: string;
  name: string;
  credits: number;
  priceEur: string;
  isActive: boolean;
  displayOrder: number;
}

export interface BundleInput {
  name: string;
  credits: number;
  /** Decimal string in EUR, at most two decimals. */
  priceEur: string;
  isActive?: boolean;
  displayOrder?: number;
}

const bundleSelect = {
  id: true,
  name: true,
  credits: true,
  priceEur: true,
  isActive: true,
  displayOrder: true,
} satisfies Prisma.CreditBundleSelect;

function toRow(b: Prisma.CreditBundleGetPayload<{ select: typeof bundleSelect }>): CreditBundleRow {
  return { ...b, priceEur: String(b.priceEur) };
}

function checkedBundle(input: Partial<BundleInput>): Prisma.CreditBundleUpdateInput {
  const data: Prisma.CreditBundleUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new InvariantError("A bundle needs a name");
    data.name = name;
  }
  if (input.credits !== undefined) {
    if (!Number.isInteger(input.credits) || input.credits < 1) {
      throw new InvariantError("Credits must be a positive whole number");
    }
    data.credits = input.credits;
  }
  if (input.priceEur !== undefined) {
    const price = input.priceEur.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(price)) throw new InvariantError("Price must be an amount in EUR, like 40 or 40.50");
    data.priceEur = price;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.displayOrder !== undefined) {
    if (!Number.isInteger(input.displayOrder)) throw new InvariantError("Display order must be a whole number");
    data.displayOrder = input.displayOrder;
  }
  return data;
}

export async function createBundle(db: PrismaClient, input: BundleInput): Promise<{ id: string }> {
  const data = checkedBundle(input);
  return db.creditBundle.create({
    data: data as Prisma.CreditBundleCreateInput,
    select: { id: true },
  });
}

export async function updateBundle(db: PrismaClient, id: string, patch: Partial<BundleInput>): Promise<void> {
  const data = checkedBundle(patch);
  const existing = await db.creditBundle.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Bundle not found");
  await db.creditBundle.update({ where: { id }, data });
}

export async function listBundles(db: PrismaClient, options: { activeOnly?: boolean } = {}): Promise<CreditBundleRow[]> {
  const rows = await db.creditBundle.findMany({
    where: options.activeOnly ? { isActive: true } : {},
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: bundleSelect,
  });
  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export interface CreditEntryRow {
  id: string;
  delta: number;
  kind: CreditEntryKind;
  note: string | null;
  bundleName: string | null;
  listingCode: string | null;
  createdAt: Date;
}

export interface CreditSummary {
  balance: number;
  /** Newest first. */
  entries: CreditEntryRow[];
}

export async function getCreditSummary(
  db: PrismaClient,
  sellerId: string,
  options: { limit?: number } = {},
): Promise<CreditSummary> {
  const seller = await db.seller.findUnique({
    where: { id: sellerId },
    select: {
      creditBalance: true,
      creditEntries: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(options.limit ? { take: options.limit } : {}),
        select: {
          id: true,
          delta: true,
          kind: true,
          note: true,
          createdAt: true,
          bundle: { select: { name: true } },
          listing: { select: { internalCode: true } },
        },
      },
    },
  });
  if (!seller) throw new NotFoundError("Seller not found");

  return {
    balance: seller.creditBalance,
    entries: seller.creditEntries.map((e) => ({
      id: e.id,
      delta: e.delta,
      kind: e.kind,
      note: e.note,
      bundleName: e.bundle?.name ?? null,
      listingCode: e.listing?.internalCode ?? null,
      createdAt: e.createdAt,
    })),
  };
}

/**
 * Change a balance and write its ledger row. A lowering only happens when the balance still
 * covers it, so it is safe under concurrency. Returns false when the seller does not exist
 * or the balance is too low.
 */
async function applyChange(
  tx: Tx,
  entry: {
    sellerId: string;
    delta: number;
    kind: CreditEntryKind;
    bundleId?: string;
    listingId?: string;
    note?: string;
    createdBy?: string | null;
  },
): Promise<boolean> {
  // One statement changes the balance and returns the new one, or finds no row when the balance is too low.
  let seller: { creditBalance: number; userId: string | null };
  try {
    seller = await tx.seller.update({
      where: { id: entry.sellerId, ...(entry.delta < 0 ? { creditBalance: { gte: -entry.delta } } : {}) },
      data: { creditBalance: { increment: entry.delta } },
      select: { creditBalance: true, userId: true },
    });
  } catch (err) {
    if (isRecordNotFound(err)) return false;
    throw err;
  }

  const written = await tx.creditLedgerEntry.create({
    data: {
      sellerId: entry.sellerId,
      delta: entry.delta,
      kind: entry.kind,
      bundleId: entry.bundleId ?? null,
      listingId: entry.listingId ?? null,
      note: entry.note ?? null,
      createdBy: entry.createdBy ?? null,
    },
    select: { id: true },
  });
  if (entry.delta < 0) await notifyIfCrossed(tx, seller, entry.delta, written.id);
  return true;
}

/** Prisma's "record to update not found" error (P2025). */
function isRecordNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2025";
}

/** The threshold at or below which a seller is told their credits are running low. */
const LOW_CREDITS = 5;

/**
 * Tell the seller when a charge or a downward adjustment makes the balance cross a threshold
 * (docs/notifications.md section 3.2): out of credits on reaching 0, or "low" on falling from
 * above 5 to between 1 and 5. A change that goes straight to 0 only says out of credits. Later
 * charges below the threshold say nothing, and a top-up or an upward adjustment never notifies.
 */
async function notifyIfCrossed(
  tx: Tx,
  seller: { creditBalance: number; userId: string | null },
  delta: number,
  entryId: string,
): Promise<void> {
  const after = seller.creditBalance;
  const before = after - delta;
  if (after === 0 && before > 0) {
    await notify(tx, { userId: seller.userId, type: "credits_empty", subjectType: "credit_ledger_entry", subjectId: entryId });
  } else if (after > 0 && after <= LOW_CREDITS && before > LOW_CREDITS) {
    await notify(tx, { userId: seller.userId, type: "credits_low", subjectType: "credit_ledger_entry", subjectId: entryId });
  }
}

async function assertSellerExists(tx: Tx, sellerId: string): Promise<void> {
  const seller = await tx.seller.findUnique({ where: { id: sellerId }, select: { id: true } });
  if (!seller) throw new NotFoundError("Seller not found");
}

/** Staff adds a bundle to a seller's balance, after the seller has paid outside the platform. */
export async function topUp(
  db: PrismaClient,
  input: { sellerId: string; bundleId: string; createdBy: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    await assertSellerExists(tx, input.sellerId);
    const bundle = await tx.creditBundle.findUnique({
      where: { id: input.bundleId },
      select: { credits: true, isActive: true },
    });
    if (!bundle) throw new NotFoundError("Bundle not found");
    if (!bundle.isActive) throw new InvariantError("This bundle is switched off and cannot be used for a top-up");

    await applyChange(tx, {
      sellerId: input.sellerId,
      delta: bundle.credits,
      kind: "topup",
      bundleId: input.bundleId,
      createdBy: input.createdBy,
    });
  });
}

/** Staff corrects a balance up or down. A note is required, and the balance may not go below zero. */
export async function adjustCredits(
  db: PrismaClient,
  input: { sellerId: string; amount: number; note: string; createdBy: string | null },
): Promise<void> {
  const note = input.note.trim();
  if (!note) throw new InvariantError("An adjustment needs a note");
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new InvariantError("An adjustment must be a whole number other than zero");
  }

  await db.$transaction(async (tx) => {
    await assertSellerExists(tx, input.sellerId);
    const done = await applyChange(tx, {
      sellerId: input.sellerId,
      delta: input.amount,
      kind: "adjustment",
      note,
      createdBy: input.createdBy,
    });
    if (!done) throw new InvariantError("That adjustment would take the balance below zero");
  });
}

/**
 * Spend one credit for publishing a listing. Call it inside the same transaction as the
 * status change, so the charge and the publish stand or fall together. Throws when the
 * seller has no credit left.
 */
export async function chargeForPublish(
  tx: Tx,
  input: { sellerId: string; listingId: string; createdBy?: string | null },
): Promise<void> {
  const done = await applyChange(tx, {
    sellerId: input.sellerId,
    delta: -1,
    kind: "publish",
    listingId: input.listingId,
    createdBy: input.createdBy,
  });
  if (!done) throw new InvariantError(NO_CREDITS_MESSAGE);
}
