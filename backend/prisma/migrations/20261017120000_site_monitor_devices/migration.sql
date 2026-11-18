-- CreateTable
CREATE TABLE "SiteDevice" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "displayName" TEXT,
    "nameLocked" BOOLEAN NOT NULL DEFAULT false,
    "namedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "language" TEXT,
    "platform" TEXT,
    "screen" TEXT,
    "timezone" TEXT,
    "lastPath" TEXT NOT NULL DEFAULT '/',
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ip" TEXT,
    "path" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteDeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteIpDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "ip" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "devices" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteIpDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteDevice_visitorId_key" ON "SiteDevice"("visitorId");

-- CreateIndex
CREATE INDEX "SiteDevice_ip_idx" ON "SiteDevice"("ip");

-- CreateIndex
CREATE INDEX "SiteDevice_lastSeenAt_idx" ON "SiteDevice"("lastSeenAt");

-- CreateIndex
CREATE INDEX "SiteDevice_displayName_idx" ON "SiteDevice"("displayName");

-- CreateIndex
CREATE INDEX "SiteDeviceEvent_deviceId_createdAt_idx" ON "SiteDeviceEvent"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteDeviceEvent_ip_createdAt_idx" ON "SiteDeviceEvent"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "SiteDeviceEvent_createdAt_idx" ON "SiteDeviceEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SiteIpDaily_day_idx" ON "SiteIpDaily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SiteIpDaily_day_ip_key" ON "SiteIpDaily"("day", "ip");

-- AddForeignKey
ALTER TABLE "SiteDeviceEvent" ADD CONSTRAINT "SiteDeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "SiteDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
