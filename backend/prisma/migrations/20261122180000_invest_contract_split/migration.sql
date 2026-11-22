-- Contract details, valuation assumption, payment method/ref, per-expense cost split.
ALTER TABLE "InvProject" ADD COLUMN "contractDetails" JSONB;
ALTER TABLE "InvProject" ADD COLUMN "estimatedValue" DECIMAL(18,3);
ALTER TABLE "InvProject" ADD COLUMN "estimatedValueDate" DATE;
ALTER TABLE "InvProject" ADD COLUMN "estimatedValueNote" TEXT;
ALTER TABLE "InvContribution" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "InvContribution" ADD COLUMN "paymentRef" TEXT;
ALTER TABLE "InvExpense" ADD COLUMN "splitMode" TEXT NOT NULL DEFAULT 'ownership';
ALTER TABLE "InvExpense" ADD COLUMN "splitShares" JSONB;
