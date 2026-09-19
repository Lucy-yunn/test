-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "deliveryCity" TEXT;

-- AlterTable
ALTER TABLE "DonorVehicle" ADD COLUMN     "scrapReason" TEXT;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3);
