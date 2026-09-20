import type { NotificationSubjectType, NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { isBuyer, isSeller, type Actor } from "../dal/actor";
import { describeNotification } from "../notification-copy";

/**
 * In-app notifications (docs/notifications.md, ADR-0008). Node-safe.
 *
 * A `Notification` row is written for a buyer or a seller, in the same transaction as the change
 * it describes, by the order, review and credit functions through `notify`. Staff have no feed.
 * There is no email in v1: these rows are the seam an email layer would hang off later.
 */

/** The client, or the transaction client inside `db.$transaction`. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Write one notification. Call it inside the transaction of the change it is about. A seller with
 * no login has nobody to notify, so a missing recipient is skipped.
 */
export async function notify(
  db: Db,
  input: { userId: string | null | undefined; type: NotificationType; subjectType: NotificationSubjectType; subjectId: string },
): Promise<void> {
  if (!input.userId) return;
  await db.notification.create({
    data: { userId: input.userId, type: input.type, subjectType: input.subjectType, subjectId: input.subjectId },
  });
}

/** Buyers and sellers have a feed; staff and anyone else do not. */
const hasFeed = (actor: Actor): boolean => isBuyer(actor) || isSeller(actor);

export interface NotificationView {
  id: string;
  type: NotificationType;
  /** One line of copy. */
  text: string;
  /** Where the notification takes you. */
  href: string;
  createdAt: Date;
  readAt: Date | null;
}

/** A person's notifications, newest first. */
export async function listNotifications(db: PrismaClient, actor: Actor, options: { limit?: number } = {}): Promise<NotificationView[]> {
  if (!hasFeed(actor)) return [];
  const rows = await db.notification.findMany({
    where: { userId: actor.userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit ?? 50,
    select: { id: true, type: true, subjectType: true, subjectId: true, createdAt: true, readAt: true },
  });

  // What each notification is about, looked up together: an order code, or the seller of a review.
  const idsOf = (t: NotificationSubjectType) => rows.filter((r) => r.subjectType === t).map((r) => r.subjectId);
  const [orders, requests, reviews] = await Promise.all([
    db.order.findMany({ where: { id: { in: idsOf("order") } }, select: { id: true, internalCode: true } }),
    db.cancellationRequest.findMany({ where: { id: { in: idsOf("cancellation_request") } }, select: { id: true, order: { select: { internalCode: true } } } }),
    db.review.findMany({ where: { id: { in: idsOf("review") } }, select: { id: true, sellerId: true } }),
  ]);
  const orderCode = new Map<string, string>([
    ...orders.map((o) => [o.id, o.internalCode] as const),
    ...requests.map((r) => [r.id, r.order.internalCode] as const),
  ]);
  const reviewSeller = new Map(reviews.map((r) => [r.id, r.sellerId]));

  return rows.map((r) => {
    const { text, href } = describeNotification(r.type, {
      orderCode: orderCode.get(r.subjectId),
      sellerId: reviewSeller.get(r.subjectId),
    });
    return { id: r.id, type: r.type, text, href, createdAt: r.createdAt, readAt: r.readAt };
  });
}

/** How many notifications the person has not opened yet. */
export async function getNotificationUnreadCount(db: PrismaClient, actor: Actor): Promise<number> {
  if (!hasFeed(actor)) return 0;
  return db.notification.count({ where: { userId: actor.userId, readAt: null } });
}

/**
 * Opening the subject marks the person's unread notifications about it read. Name the subject ids,
 * or leave them out to mark every notification of that kind (for example all review notices when
 * the seller opens their Reviews). Returns how many it marked.
 */
export async function markRead(
  db: PrismaClient,
  actor: Actor,
  input: { subjectType: NotificationSubjectType; subjectIds?: readonly string[] },
): Promise<number> {
  if (!hasFeed(actor)) return 0;
  const { count } = await db.notification.updateMany({
    where: {
      userId: actor.userId,
      readAt: null,
      subjectType: input.subjectType,
      ...(input.subjectIds ? { subjectId: { in: [...input.subjectIds] } } : {}),
    },
    data: { readAt: new Date() },
  });
  return count;
}

/**
 * Opening a seller's Reviews. A seller marks all their review notices read. A buyer marks the
 * "the seller replied" notices for their own reviews of that seller.
 */
export async function markReviewsRead(db: PrismaClient, actor: Actor, sellerId?: string): Promise<number> {
  if (isSeller(actor)) return markRead(db, actor, { subjectType: "review" });
  if (!isBuyer(actor) || !sellerId) return 0;
  const mine = await db.review.findMany({ where: { buyerId: actor.buyerId!, sellerId }, select: { id: true } });
  return markRead(db, actor, { subjectType: "review", subjectIds: mine.map((r) => r.id) });
}

/** Mark all as read: clears the person's feed. */
export async function markAllRead(db: PrismaClient, actor: Actor): Promise<number> {
  if (!hasFeed(actor)) return 0;
  const { count } = await db.notification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
  return count;
}
