-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('new', 'contacted', 'closed');

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "industryType" TEXT,
    "activityType" TEXT,
    "details" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'new',
    "adminNotes" TEXT,
    "reviewer" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactRequest_serialNo_key" ON "ContactRequest"("serialNo");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");
