-- CreateEnum
CREATE TYPE "InvProjectStatus" AS ENUM ('draft', 'fundraising', 'capital_collection', 'acquisition_pending', 'acquired', 'active_management', 'listed_for_sale', 'sale_pending', 'sold', 'settlement_pending', 'settled', 'closed', 'cancelled');
-- CreateEnum
CREATE TYPE "InvApprovalStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'reversed');
-- CreateEnum
CREATE TYPE "InvContributionKind" AS ENUM ('initial', 'additional', 'capital_call', 'adjustment', 'withdrawal');
-- CreateEnum
CREATE TYPE "InvExpenseStatus" AS ENUM ('pending', 'approved', 'rejected', 'reimbursed', 'written_off');
-- CreateEnum
CREATE TYPE "InvCommissionBasis" AS ENUM ('investor_net_profit', 'distributable_profit', 'sale_value', 'fixed', 'hybrid');
-- CreateEnum
CREATE TYPE "InvJournalStatus" AS ENUM ('draft', 'posted', 'reversed');
-- CreateEnum
CREATE TYPE "InvSettlementStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'posted', 'paid', 'cancelled');
-- CreateEnum
CREATE TYPE "InvDocumentKind" AS ENUM ('land_deed', 'purchase_agreement', 'sale_agreement', 'investor_contract', 'receipt', 'legal', 'expense_invoice', 'bank_transfer', 'property_photo', 'valuation', 'statement', 'other');

-- CreateTable
CREATE TABLE "InvOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseCurrency" VARCHAR(3) NOT NULL DEFAULT 'JOD',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Amman',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvInvestor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "nationalIdEnc" TEXT,
    "address" TEXT,
    "bankDetailsEnc" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvInvestor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvPortalUser" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL DEFAULT 'JO',
    "city" TEXT,
    "area" TEXT,
    "landLocation" TEXT,
    "plotParcelNo" TEXT,
    "landAreaSqm" DECIMAL(18,3),
    "purchasePrice" DECIMAL(18,3),
    "targetSalePrice" DECIMAL(18,3),
    "purchaseDate" DATE,
    "expectedSaleDate" DATE,
    "actualSalePrice" DECIMAL(18,3),
    "actualSaleDate" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JOD',
    "currencyScale" INTEGER NOT NULL DEFAULT 3,
    "status" "InvProjectStatus" NOT NULL DEFAULT 'draft',
    "coordinatorUserId" TEXT,
    "waterfallSteps" JSONB,
    "commissionRule" JSONB,
    "coordinatorParticipatesInProfit" BOOLEAN NOT NULL DEFAULT true,
    "agreementNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "InvProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvProjectStatusEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" "InvProjectStatus",
    "toStatus" "InvProjectStatus" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvProjectStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvMembership" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "isCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "ownershipPercent" DECIMAL(12,8),
    "roleLabel" TEXT,
    "commissionOverride" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvContribution" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "kind" "InvContributionKind" NOT NULL DEFAULT 'initial',
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "contributedAt" DATE NOT NULL,
    "description" TEXT,
    "countsAsEquity" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "InvApprovalStatus" NOT NULL DEFAULT 'approved',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvExpense" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "payerInvestorId" TEXT,
    "paidByCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "status" "InvExpenseStatus" NOT NULL DEFAULT 'pending',
    "reimbursementDue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reimbursementPaid" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT,

    CONSTRAINT "InvExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvCommissionRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" "InvCommissionBasis" NOT NULL,
    "percent" DECIMAL(8,4),
    "fixedAmount" DECIMAL(18,3),
    "perInvestorJson" JSONB,
    "chargeOnCoordinatorProfit" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvLedgerAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JOD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvLedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvJournal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" "InvJournalStatus" NOT NULL DEFAULT 'draft',
    "memo" TEXT,
    "valueDate" DATE NOT NULL,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "reversesJournalId" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvJournalLine" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT,
    "debit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "memo" TEXT,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "InvJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvTransaction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partnerId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "description" TEXT,
    "approvalStatus" "InvApprovalStatus" NOT NULL DEFAULT 'pending',
    "createdBy" TEXT,
    "journalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvSettlement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "InvSettlementStatus" NOT NULL DEFAULT 'draft',
    "saleProceeds" DECIMAL(18,3) NOT NULL,
    "closingCosts" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unpaidLiabilities" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "resultJson" JSONB,
    "hypothetical" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "capitalReturned" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "expenseReimbursement" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "profitShare" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "commissionEarned" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalPayout" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "InvSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "investorId" TEXT,
    "expenseId" TEXT,
    "kind" "InvDocumentKind" NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvOrganization_slug_key" ON "InvOrganization"("slug");

-- CreateIndex
CREATE INDEX "InvInvestor_organizationId_idx" ON "InvInvestor"("organizationId");

-- CreateIndex
CREATE INDEX "InvInvestor_email_idx" ON "InvInvestor"("email");

-- CreateIndex
CREATE INDEX "InvInvestor_legalName_idx" ON "InvInvestor"("legalName");

-- CreateIndex
CREATE UNIQUE INDEX "InvPortalUser_investorId_key" ON "InvPortalUser"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "InvPortalUser_email_key" ON "InvPortalUser"("email");

-- CreateIndex
CREATE INDEX "InvProject_organizationId_status_idx" ON "InvProject"("organizationId", "status");

-- CreateIndex
CREATE INDEX "InvProject_status_idx" ON "InvProject"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvProject_organizationId_referenceNo_key" ON "InvProject"("organizationId", "referenceNo");

-- CreateIndex
CREATE INDEX "InvProjectStatusEvent_projectId_createdAt_idx" ON "InvProjectStatusEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "InvMembership_investorId_idx" ON "InvMembership"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "InvMembership_projectId_investorId_key" ON "InvMembership"("projectId", "investorId");

-- CreateIndex
CREATE INDEX "InvContribution_projectId_contributedAt_idx" ON "InvContribution"("projectId", "contributedAt");

-- CreateIndex
CREATE INDEX "InvContribution_investorId_idx" ON "InvContribution"("investorId");

-- CreateIndex
CREATE INDEX "InvExpense_projectId_status_idx" ON "InvExpense"("projectId", "status");

-- CreateIndex
CREATE INDEX "InvExpense_payerInvestorId_idx" ON "InvExpense"("payerInvestorId");

-- CreateIndex
CREATE INDEX "InvCommissionRule_projectId_active_idx" ON "InvCommissionRule"("projectId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "InvLedgerAccount_organizationId_code_key" ON "InvLedgerAccount"("organizationId", "code");

-- CreateIndex
CREATE INDEX "InvJournal_projectId_status_idx" ON "InvJournal"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvJournal_organizationId_idempotencyKey_key" ON "InvJournal"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "InvJournalLine_journalId_idx" ON "InvJournalLine"("journalId");

-- CreateIndex
CREATE INDEX "InvJournalLine_accountId_idx" ON "InvJournalLine"("accountId");

-- CreateIndex
CREATE INDEX "InvTransaction_projectId_transactionDate_idx" ON "InvTransaction"("projectId", "transactionDate");

-- CreateIndex
CREATE INDEX "InvTransaction_partnerId_idx" ON "InvTransaction"("partnerId");

-- CreateIndex
CREATE INDEX "InvSettlement_projectId_status_idx" ON "InvSettlement"("projectId", "status");

-- CreateIndex
CREATE INDEX "InvSettlementLine_settlementId_idx" ON "InvSettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "InvSettlementLine_partnerId_idx" ON "InvSettlementLine"("partnerId");

-- CreateIndex
CREATE INDEX "InvDocument_projectId_idx" ON "InvDocument"("projectId");

-- CreateIndex
CREATE INDEX "InvDocument_investorId_idx" ON "InvDocument"("investorId");

-- CreateIndex
CREATE INDEX "InvAuditEvent_entityType_entityId_idx" ON "InvAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InvAuditEvent_createdAt_idx" ON "InvAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "InvAuditEvent_action_idx" ON "InvAuditEvent"("action");

-- AddForeignKey
ALTER TABLE "InvInvestor" ADD CONSTRAINT "InvInvestor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "InvOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvPortalUser" ADD CONSTRAINT "InvPortalUser_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvInvestor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvProject" ADD CONSTRAINT "InvProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "InvOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvProjectStatusEvent" ADD CONSTRAINT "InvProjectStatusEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvMembership" ADD CONSTRAINT "InvMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvMembership" ADD CONSTRAINT "InvMembership_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvInvestor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvContribution" ADD CONSTRAINT "InvContribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvContribution" ADD CONSTRAINT "InvContribution_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvInvestor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvExpense" ADD CONSTRAINT "InvExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvExpense" ADD CONSTRAINT "InvExpense_payerInvestorId_fkey" FOREIGN KEY ("payerInvestorId") REFERENCES "InvInvestor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvCommissionRule" ADD CONSTRAINT "InvCommissionRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvLedgerAccount" ADD CONSTRAINT "InvLedgerAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "InvOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvJournal" ADD CONSTRAINT "InvJournal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvJournal" ADD CONSTRAINT "InvJournal_reversesJournalId_fkey" FOREIGN KEY ("reversesJournalId") REFERENCES "InvJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvJournalLine" ADD CONSTRAINT "InvJournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "InvJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvJournalLine" ADD CONSTRAINT "InvJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvTransaction" ADD CONSTRAINT "InvTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvTransaction" ADD CONSTRAINT "InvTransaction_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "InvJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvSettlement" ADD CONSTRAINT "InvSettlement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvSettlementLine" ADD CONSTRAINT "InvSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "InvSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvDocument" ADD CONSTRAINT "InvDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InvProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvDocument" ADD CONSTRAINT "InvDocument_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvInvestor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvDocument" ADD CONSTRAINT "InvDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "InvExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
