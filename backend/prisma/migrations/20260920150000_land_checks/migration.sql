-- CreateEnum
CREATE TYPE "LandCheckStatus" AS ENUM ('new', 'contacted', 'closed');

-- CreateTable
CREATE TABLE "LandCheck" (
    "id" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "governorate" TEXT NOT NULL,
    "directorate" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "basin" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "parcel" TEXT NOT NULL,
    "coordinates" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "dlsKey" TEXT,
    "areaSqm" DOUBLE PRECISION,
    "areaLabel" TEXT,
    "administrativeValue" DOUBLE PRECISION,
    "administrativeValueSource" TEXT,
    "administrativeValueAt" TIMESTAMP(3),
    "estimatedMedian" DOUBLE PRECISION,
    "industryType" "IndustryType",
    "notes" TEXT,
    "status" "LandCheckStatus" NOT NULL DEFAULT 'new',
    "adminNotes" TEXT,
    "reviewer" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandCheck_serialNo_key" ON "LandCheck"("serialNo");

-- CreateIndex
CREATE INDEX "LandCheck_status_idx" ON "LandCheck"("status");

-- CreateIndex
CREATE INDEX "LandCheck_createdAt_idx" ON "LandCheck"("createdAt");

-- CreateIndex
CREATE INDEX "LandCheck_village_basin_parcel_idx" ON "LandCheck"("village", "basin", "parcel");
