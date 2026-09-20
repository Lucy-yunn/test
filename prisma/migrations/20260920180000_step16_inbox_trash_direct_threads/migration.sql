-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "buyerTrashedAt" TIMESTAMP(3),
ADD COLUMN     "sellerTrashedAt" TIMESTAMP(3),
ALTER COLUMN "listingId" DROP NOT NULL;

-- One direct conversation (no listing) per seller and buyer. Prisma cannot express a partial
-- unique index, so it lives only here; a NULL listingId never collides in the ordinary
-- (listingId, buyerId) key.
CREATE UNIQUE INDEX "Thread_direct_pair_key" ON "Thread"("sellerId", "buyerId") WHERE "listingId" IS NULL;
