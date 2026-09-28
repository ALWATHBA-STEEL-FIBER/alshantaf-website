-- Official DLS administrative-value lookup result, kept with provenance
-- (source + retrieval time) — never conflated with the listing's own price.
ALTER TABLE "Listing" ADD COLUMN "administrativeValue" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN "administrativeValueSource" TEXT;
ALTER TABLE "Listing" ADD COLUMN "administrativeValueAt" TIMESTAMP(3);
