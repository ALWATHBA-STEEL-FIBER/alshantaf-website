-- Structured coordinates coexist with the legacy coordinate string so existing
-- listings and submissions remain readable while new map selections are typed.
ALTER TABLE "Listing" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN "address" TEXT;
ALTER TABLE "Submission" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Submission" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Submission" ADD COLUMN "address" TEXT;
