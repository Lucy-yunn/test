-- Order model revised by ADR-0009 (docs/order-model.md): cash on delivery, seller-operated.
-- shipped and delivered are gone. Existing rows are carried over: shipped -> confirmed,
-- delivered -> completed. The shipping and tracking columns are dropped.

-- AlterTable: new columns first, so delivered orders keep their date as the completion date.
ALTER TABLE "Order"
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "refusalNote" TEXT,
ADD COLUMN "refusedAt" TIMESTAMP(3);

UPDATE "Order" SET "completedAt" = "deliveredAt" WHERE "status" = 'delivered';

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('placed', 'confirmed', 'completed', 'cancelled', 'refused');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text WHEN 'shipped' THEN 'confirmed' WHEN 'delivered' THEN 'completed' ELSE "status"::text END
)::"OrderStatus_new";
ALTER TABLE "Order" ALTER COLUMN "lastReachedStatus" TYPE "OrderStatus_new" USING (
  CASE "lastReachedStatus"::text WHEN 'shipped' THEN 'confirmed' WHEN 'delivered' THEN 'completed' ELSE "lastReachedStatus"::text END
)::"OrderStatus_new";
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'placed';
COMMIT;

-- A listing can be reserved again after a cancelled or refused order, so it is no longer unique.
DROP INDEX "Order_listingId_key";

-- AlterTable
ALTER TABLE "CancellationRequest" DROP COLUMN "requestedBy";

ALTER TABLE "Order"
DROP COLUMN "deliveredAt",
DROP COLUMN "expectedTimeRange",
DROP COLUMN "shippedAt",
DROP COLUMN "shippingCostEur",
DROP COLUMN "shippingNotes",
DROP COLUMN "trackingNumber";

-- CreateIndex
CREATE INDEX "Order_listingId_idx" ON "Order"("listingId");
