-- Add the DLS directorate (مديرية) tier, which sits between governorate and
-- village, to both Listing and Submission.
ALTER TABLE "Listing" ADD COLUMN "directorate" TEXT;
ALTER TABLE "Submission" ADD COLUMN "directorate" TEXT;
