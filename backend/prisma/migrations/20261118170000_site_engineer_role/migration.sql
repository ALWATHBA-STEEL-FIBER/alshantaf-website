-- Coordinator vs field engineer
ALTER TABLE "SiteEngineer" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'ENGINEER';

-- Ensure expense/coordinator columns exist (safe if already applied)
ALTER TABLE "SiteProject" ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;
ALTER TABLE "SiteProject" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(14,3);
CREATE INDEX IF NOT EXISTS "SiteProject_coordinatorId_idx" ON "SiteProject"("coordinatorId");

DO $$ BEGIN
  ALTER TABLE "SiteProject"
    ADD CONSTRAINT "SiteProject_coordinatorId_fkey"
    FOREIGN KEY ("coordinatorId") REFERENCES "SiteEngineer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
