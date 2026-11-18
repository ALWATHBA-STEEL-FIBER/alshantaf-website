-- AlterTable
ALTER TABLE "SiteWorker" ADD COLUMN IF NOT EXISTS "dailyPay" DECIMAL(10,3) NOT NULL DEFAULT 0;
ALTER TABLE "SiteWorker" ADD COLUMN IF NOT EXISTS "extraHourPay" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteWorkerWeekPayout" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "daysWorked" INTEGER NOT NULL DEFAULT 0,
    "totalExtraHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "dailyPay" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "extraHourPay" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteWorkerWeekPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SiteWorkerWeekPayout_workerId_projectId_weekStart_key"
  ON "SiteWorkerWeekPayout"("workerId", "projectId", "weekStart");

CREATE INDEX IF NOT EXISTS "SiteWorkerWeekPayout_projectId_weekStart_idx"
  ON "SiteWorkerWeekPayout"("projectId", "weekStart");

CREATE INDEX IF NOT EXISTS "SiteWorkerWeekPayout_workerId_paid_idx"
  ON "SiteWorkerWeekPayout"("workerId", "paid");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SiteWorkerWeekPayout"
    ADD CONSTRAINT "SiteWorkerWeekPayout_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "SiteWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SiteWorkerWeekPayout"
    ADD CONSTRAINT "SiteWorkerWeekPayout_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
