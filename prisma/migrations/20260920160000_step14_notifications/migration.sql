-- Notifications follow the cash-on-delivery order model and add review and credit events
-- (docs/notifications.md section 3). Old rows are carried over where they still make sense:
-- order_delivered becomes order_completed. Shipping and warning notifications no longer exist,
-- and a buyer no longer gets order_placed, so those rows are removed.
DELETE FROM "Notification" WHERE "type" IN ('order_shipped', 'cancellation_warning');
DELETE FROM "Notification" WHERE "type" = 'order_placed' AND "userId" IN (SELECT "id" FROM "user" WHERE "role" = 'buyer');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('order_placed', 'order_confirmed', 'order_completed', 'order_refused', 'order_cancelled', 'cancellation_requested', 'cancellation_approved', 'review_received', 'review_replied', 'credits_low', 'credits_empty');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING (
  CASE "type"::text WHEN 'order_delivered' THEN 'order_completed' ELSE "type"::text END
)::"NotificationType_new";
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "NotificationSubjectType" ADD VALUE 'review';
ALTER TYPE "NotificationSubjectType" ADD VALUE 'credit_ledger_entry';
