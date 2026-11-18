-- CreateEnum
CREATE TYPE "OrderBrand" AS ENUM ('alshantaf', 'steelfiber');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('payments', 'installments', 'one_time', 'service');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('open', 'closed', 'void');

-- CreateEnum
CREATE TYPE "OrderInstallmentStatus" AS ENUM ('due', 'paid', 'skipped');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "brand" "OrderBrand" NOT NULL,
    "kind" "OrderKind" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'open',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "totalAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "note" TEXT,
    "markedBy" TEXT NOT NULL,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderInstallment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "status" "OrderInstallmentStatus" NOT NULL DEFAULT 'due',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAccessToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OrderAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_serialNo_key" ON "orders"("serialNo");

-- CreateIndex
CREATE INDEX "orders_brand_createdAt_idx" ON "orders"("brand", "createdAt");

-- CreateIndex
CREATE INDEX "orders_brand_status_idx" ON "orders"("brand", "status");

-- CreateIndex
CREATE INDEX "orders_customerPhone_idx" ON "orders"("customerPhone");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_paidAt_idx" ON "OrderPayment"("paidAt");

-- CreateIndex
CREATE INDEX "OrderInstallment_orderId_idx" ON "OrderInstallment"("orderId");

-- CreateIndex
CREATE INDEX "OrderInstallment_dueDate_idx" ON "OrderInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAccessToken_tokenHash_key" ON "OrderAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OrderAccessToken_orderId_idx" ON "OrderAccessToken"("orderId");

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderInstallment" ADD CONSTRAINT "OrderInstallment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAccessToken" ADD CONSTRAINT "OrderAccessToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
