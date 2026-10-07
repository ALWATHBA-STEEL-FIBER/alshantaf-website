-- Official Amman building regulation classes (نظام 28/2018) missing from enum
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'residentialPopular';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'residentialHighDensity';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'mixedUseUrban';
ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'industrialGeneral';
