-- CreateTable
CREATE TABLE "SiteEngineer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteEngineer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteWorker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProjectEngineer" (
    "projectId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteProjectEngineer_pkey" PRIMARY KEY ("projectId","engineerId")
);

-- CreateTable
CREATE TABLE "SiteProjectWorker" (
    "projectId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteProjectWorker_pkey" PRIMARY KEY ("projectId","workerId")
);

-- CreateTable
CREATE TABLE "SiteDailyRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "regularHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "extraHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteEngineer_email_key" ON "SiteEngineer"("email");

-- CreateIndex
CREATE INDEX "SiteProjectEngineer_engineerId_idx" ON "SiteProjectEngineer"("engineerId");

-- CreateIndex
CREATE INDEX "SiteProjectWorker_workerId_idx" ON "SiteProjectWorker"("workerId");

-- CreateIndex
CREATE INDEX "SiteDailyRecord_workDate_idx" ON "SiteDailyRecord"("workDate");

-- CreateIndex
CREATE INDEX "SiteDailyRecord_engineerId_idx" ON "SiteDailyRecord"("engineerId");

-- CreateIndex
CREATE INDEX "SiteDailyRecord_workerId_idx" ON "SiteDailyRecord"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDailyRecord_projectId_workerId_workDate_key" ON "SiteDailyRecord"("projectId", "workerId", "workDate");

-- AddForeignKey
ALTER TABLE "SiteProjectEngineer" ADD CONSTRAINT "SiteProjectEngineer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProjectEngineer" ADD CONSTRAINT "SiteProjectEngineer_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "SiteEngineer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProjectWorker" ADD CONSTRAINT "SiteProjectWorker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProjectWorker" ADD CONSTRAINT "SiteProjectWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "SiteWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDailyRecord" ADD CONSTRAINT "SiteDailyRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDailyRecord" ADD CONSTRAINT "SiteDailyRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "SiteWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDailyRecord" ADD CONSTRAINT "SiteDailyRecord_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "SiteEngineer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
