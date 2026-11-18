-- CreateEnum
CREATE TYPE "OfferImportance" AS ENUM ('none', 'golden', 'platinum', 'titanium');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "importance" "OfferImportance" NOT NULL DEFAULT 'none';

-- Backfill: former featured listings become titanium
UPDATE "Listing" SET "importance" = 'titanium' WHERE "featured" = true;

-- CreateIndex
CREATE INDEX "Listing_importance_idx" ON "Listing"("importance");
