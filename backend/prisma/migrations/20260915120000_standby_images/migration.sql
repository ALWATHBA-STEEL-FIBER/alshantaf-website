-- CreateTable
CREATE TABLE "StandbyImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandbyImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandbyImage_url_key" ON "StandbyImage"("url");

-- CreateIndex
CREATE INDEX "StandbyImage_createdAt_idx" ON "StandbyImage"("createdAt");
