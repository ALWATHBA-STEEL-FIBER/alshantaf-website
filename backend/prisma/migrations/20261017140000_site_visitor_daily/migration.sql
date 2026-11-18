-- CreateTable
CREATE TABLE "SiteVisitorDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visitorId" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisitorDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVisitorDaily_day_idx" ON "SiteVisitorDaily"("day");

-- CreateIndex
CREATE INDEX "SiteVisitorDaily_visitorId_idx" ON "SiteVisitorDaily"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitorDaily_day_visitorId_key" ON "SiteVisitorDaily"("day", "visitorId");
