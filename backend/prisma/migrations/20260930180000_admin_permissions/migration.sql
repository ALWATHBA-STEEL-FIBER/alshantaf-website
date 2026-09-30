-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[];

-- Ensure every existing admin has full privilege
UPDATE "User" SET "permissions" = ARRAY['*']::TEXT[] WHERE cardinality("permissions") = 0 OR "permissions" IS NULL;
