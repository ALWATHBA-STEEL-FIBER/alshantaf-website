-- SH-QAS-0003 stores four parcels (706–709) but size was saved from a single
-- parcel (~2 dunums). Sum of DLS SHAPE.AREA for all four ≈ 8,000.89 m².
UPDATE "Listing"
SET "size" = '8,000.89 م² · 8.001 دونم'
WHERE "listingNo" = 'SH-QAS-0003'
  AND "parcel" LIKE '%706%'
  AND "parcel" LIKE '%709%';
