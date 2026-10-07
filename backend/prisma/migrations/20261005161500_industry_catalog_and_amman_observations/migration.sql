-- CreateTable
CREATE TABLE "IndustryTypeCatalog" (
    "industryType" "IndustryType" NOT NULL,
    "category" TEXT NOT NULL,
    "ammanAutoEligible" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryTypeCatalog_pkey" PRIMARY KEY ("industryType")
);

-- CreateTable
CREATE TABLE "AmmanZoningObservation" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "zoningNo" TEXT,
    "zoningName" TEXT,
    "districtName" TEXT,
    "industryType" "IndustryType",
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmmanZoningObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmmanZoningObservation_sourceKey_key" ON "AmmanZoningObservation"("sourceKey");

-- CreateIndex
CREATE INDEX "AmmanZoningObservation_industryType_idx" ON "AmmanZoningObservation"("industryType");

-- CreateIndex
CREATE INDEX "AmmanZoningObservation_lastSeenAt_idx" ON "AmmanZoningObservation"("lastSeenAt");
