-- CreateTable
CREATE TABLE "SavedSeller" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSeller_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSeller_sellerId_idx" ON "SavedSeller"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSeller_buyerId_sellerId_key" ON "SavedSeller"("buyerId", "sellerId");

-- AddForeignKey
ALTER TABLE "SavedSeller" ADD CONSTRAINT "SavedSeller_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSeller" ADD CONSTRAINT "SavedSeller_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
