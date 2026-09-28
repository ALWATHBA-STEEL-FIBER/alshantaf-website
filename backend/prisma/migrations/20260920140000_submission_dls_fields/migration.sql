-- AlterTable
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "administrativeValue" DOUBLE PRECISION;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "administrativeValueSource" TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "administrativeValueAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "dlsKey" TEXT;
