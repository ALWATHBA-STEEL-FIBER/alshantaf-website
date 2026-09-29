-- Hide mid-range DLS estimate on public offers when admin opts out.
ALTER TABLE "Listing" ADD COLUMN "showEstimatedValue" BOOLEAN NOT NULL DEFAULT true;

