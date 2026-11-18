-- Project coordinator + budget
ALTER TABLE "SiteProject" ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;
ALTER TABLE "SiteProject" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(14,3);
CREATE INDEX IF NOT EXISTS "SiteProject_coordinatorId_idx" ON "SiteProject"("coordinatorId");

DO $$ BEGIN
  ALTER TABLE "SiteProject"
    ADD CONSTRAINT "SiteProject_coordinatorId_fkey"
    FOREIGN KEY ("coordinatorId") REFERENCES "SiteEngineer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Expenses
CREATE TABLE IF NOT EXISTS "SiteExpense" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "projectId" TEXT,
    "engineerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "vendor" TEXT,
    "paymentMethod" TEXT,
    "invoiceNo" TEXT,
    "receiptFile" TEXT,
    "receiptMime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteExpense_projectId_expenseDate_idx" ON "SiteExpense"("projectId", "expenseDate");
CREATE INDEX IF NOT EXISTS "SiteExpense_engineerId_expenseDate_idx" ON "SiteExpense"("engineerId", "expenseDate");
CREATE INDEX IF NOT EXISTS "SiteExpense_scope_expenseDate_idx" ON "SiteExpense"("scope", "expenseDate");
CREATE INDEX IF NOT EXISTS "SiteExpense_expenseDate_idx" ON "SiteExpense"("expenseDate");

DO $$ BEGIN
  ALTER TABLE "SiteExpense"
    ADD CONSTRAINT "SiteExpense_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SiteExpense"
    ADD CONSTRAINT "SiteExpense_engineerId_fkey"
    FOREIGN KEY ("engineerId") REFERENCES "SiteEngineer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
