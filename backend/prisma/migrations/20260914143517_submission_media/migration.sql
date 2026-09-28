-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "document" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "video" TEXT;
