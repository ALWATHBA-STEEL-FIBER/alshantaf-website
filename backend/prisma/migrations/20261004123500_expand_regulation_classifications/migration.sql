-- AlterEnum
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'industrialCraft';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'industrialHeavy';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'industrialTransformative';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'commercialOffice';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'commercialIndustrial';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'commercialNeighborhoodService';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'commercialCenter';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'mixedUse';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'mixedUseEntertainment';
