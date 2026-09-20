-- CreateEnum
CREATE TYPE "CreditEntryKind" AS ENUM ('topup', 'publish', 'adjustment');

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceEur" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" "CreditEntryKind" NOT NULL,
    "bundleId" TEXT,
    "listingId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_sellerId_createdAt_idx" ON "CreditLedgerEntry"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CreditBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
