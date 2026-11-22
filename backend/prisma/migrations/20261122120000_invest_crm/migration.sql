-- Partner CRM fields, per-partner coordinator cut, loss sharing, richer settlement lines.
ALTER TABLE "InvInvestor" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "InvInvestor" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE "InvInvestor" ADD COLUMN IF NOT EXISTS "nationalIdHash" TEXT;
ALTER TABLE "InvInvestor" ADD COLUMN IF NOT EXISTS "nationalIdLast4" TEXT;
ALTER TABLE "InvInvestor" ADD COLUMN IF NOT EXISTS "city" TEXT;

-- Backfill partner numbers in creation order.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt", "id") AS rn
  FROM "InvInvestor" WHERE "code" IS NULL
)
UPDATE "InvInvestor" i
SET "code" = 'P-' || LPAD((n.rn + COALESCE((
  SELECT MAX(CAST(SUBSTRING(x."code" FROM 3) AS INTEGER)) FROM "InvInvestor" x
  WHERE x."organizationId" = i."organizationId" AND x."code" ~ '^P-[0-9]+$'), 0))::TEXT, 4, '0')
FROM numbered n WHERE n."id" = i."id";

CREATE UNIQUE INDEX IF NOT EXISTS "InvInvestor_organizationId_code_key" ON "InvInvestor"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "InvInvestor_nationalIdHash_idx" ON "InvInvestor"("nationalIdHash");
CREATE INDEX IF NOT EXISTS "InvInvestor_phone_idx" ON "InvInvestor"("phone");

ALTER TABLE "InvMembership" ADD COLUMN IF NOT EXISTS "commissionPercent" DECIMAL(8,4);
ALTER TABLE "InvMembership" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "InvProject" ADD COLUMN IF NOT EXISTS "shareLossesByOwnership" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "InvSettlementLine" ADD COLUMN IF NOT EXISTS "ownershipPercent" DECIMAL(12,8) NOT NULL DEFAULT 0;
ALTER TABLE "InvSettlementLine" ADD COLUMN IF NOT EXISTS "grossProfit" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "InvSettlementLine" ADD COLUMN IF NOT EXISTS "commissionPaid" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "InvSettlementLine" ADD COLUMN IF NOT EXISTS "paidRef" TEXT;
