-- CreateTable
CREATE TABLE "MarketSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'JO',
    "sourceType" TEXT NOT NULL,
    "updateFrequency" TEXT NOT NULL,
    "reliability" TEXT NOT NULL DEFAULT 'official',
    "lastChecked" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextExpectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketMetric" (
    "id" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "frequency" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'latest_available',
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "isCalculated" BOOLEAN NOT NULL DEFAULT false,
    "confidence" TEXT NOT NULL DEFAULT 'high',
    "previousValue" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketMetricRevision" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "revisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "MarketMetricRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePageViewDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePageViewDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketSource_key_key" ON "MarketSource"("key");

-- CreateIndex
CREATE INDEX "MarketMetric_metricKey_periodEnd_idx" ON "MarketMetric"("metricKey", "periodEnd");

-- CreateIndex
CREATE INDEX "MarketMetric_category_idx" ON "MarketMetric"("category");

-- CreateIndex
CREATE INDEX "MarketMetric_retrievedAt_idx" ON "MarketMetric"("retrievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketMetric_metricKey_periodEnd_sourceId_key" ON "MarketMetric"("metricKey", "periodEnd", "sourceId");

-- CreateIndex
CREATE INDEX "SitePageViewDaily_day_idx" ON "SitePageViewDaily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SitePageViewDaily_day_path_key" ON "SitePageViewDaily"("day", "path");

-- AddForeignKey
ALTER TABLE "MarketMetric" ADD CONSTRAINT "MarketMetric_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MarketSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketMetricRevision" ADD CONSTRAINT "MarketMetricRevision_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "MarketMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
