-- Add the same DLS governorate/village/neighborhood location fields used on
-- submissions so admin-authored listings can use the official location cascade.
ALTER TABLE "Listing" ADD COLUMN "governorate" TEXT;
ALTER TABLE "Listing" ADD COLUMN "village" TEXT;
ALTER TABLE "Listing" ADD COLUMN "neighborhood" TEXT;
