-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'canceled';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "ownerAccessCode" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "smsOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "notifiedMilestones" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Listing_ownerAccessCode_key" ON "Listing"("ownerAccessCode");
