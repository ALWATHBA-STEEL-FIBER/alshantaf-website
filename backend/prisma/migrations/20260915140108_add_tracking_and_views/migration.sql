-- Listing: view counter
ALTER TABLE "Listing" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- Dedupe table for unique-visitor view counting
CREATE TABLE "ListingView" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingView_listingId_visitorId_key" ON "ListingView"("listingId", "visitorId");
CREATE INDEX "ListingView_listingId_idx" ON "ListingView"("listingId");

ALTER TABLE "ListingView" ADD CONSTRAINT "ListingView_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Submission: serial number + tracking code, added nullable so existing rows can be backfilled
ALTER TABLE "Submission" ADD COLUMN "serialNo" TEXT;
ALTER TABLE "Submission" ADD COLUMN "trackingCode" TEXT;

-- Backfill: pre-existing submissions get a deterministic legacy serial/tracking pair
-- based on submission order, so the columns can safely become NOT NULL + UNIQUE below.
UPDATE "Submission" s
SET "serialNo" = 'REQ-' || LPAD(sub.rn::text, 5, '0'),
    "trackingCode" = 'LEGACY' || LPAD(sub.rn::text, 6, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "submittedAt" ASC) AS rn FROM "Submission"
) sub
WHERE s."id" = sub."id";

ALTER TABLE "Submission" ALTER COLUMN "serialNo" SET NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "trackingCode" SET NOT NULL;

CREATE UNIQUE INDEX "Submission_serialNo_key" ON "Submission"("serialNo");
CREATE UNIQUE INDEX "Submission_trackingCode_key" ON "Submission"("trackingCode");
