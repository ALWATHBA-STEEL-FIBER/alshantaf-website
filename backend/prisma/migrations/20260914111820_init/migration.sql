-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('light', 'medium', 'technical');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('sale', 'rent', 'sale_or_rent', 'partnership');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('available', 'reserved', 'sold', 'rented');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('published', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "PresenterRole" AS ENUM ('owner', 'presenter', 'broker', 'company', 'other');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video', 'document');

-- CreateEnum
CREATE TYPE "SubmissionSource" AS ENUM ('owner', 'broker');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending', 'duplicate_review', 'needs_info', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "listingNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "propertyType" TEXT,
    "industryType" "IndustryType" NOT NULL,
    "dealType" "DealType" NOT NULL DEFAULT 'sale',
    "size" TEXT,
    "price" TEXT,
    "basin" TEXT,
    "parcel" TEXT,
    "locationUrl" TEXT,
    "phone" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'available',
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "presenterRole" "PresenterRole",
    "presenterName" TEXT,
    "showPresenter" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "internalNotes" TEXT,
    "mainImage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "source" "SubmissionSource" NOT NULL,
    "applicant" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "office" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "authExpiry" TEXT,
    "governorate" TEXT,
    "village" TEXT,
    "basin" TEXT,
    "parcel" TEXT,
    "neighborhood" TEXT,
    "coordinates" TEXT,
    "area" TEXT,
    "price" TEXT,
    "industryType" "IndustryType",
    "activity" TEXT,
    "details" TEXT NOT NULL,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "reviewer" TEXT,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "convertedListingId" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_listingNo_key" ON "Listing"("listingNo");

-- CreateIndex
CREATE INDEX "Listing_area_idx" ON "Listing"("area");

-- CreateIndex
CREATE INDEX "Listing_publishStatus_idx" ON "Listing"("publishStatus");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Media_listingId_idx" ON "Media"("listingId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_convertedListingId_fkey" FOREIGN KEY ("convertedListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
