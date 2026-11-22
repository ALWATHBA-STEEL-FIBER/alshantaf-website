-- Link an admin user to their own partner profile (default project coordinator).
ALTER TABLE "InvInvestor" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "InvInvestor_userId_key" ON "InvInvestor"("userId");
